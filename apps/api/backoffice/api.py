"""Backoffice da plataforma (equipa PagaMOZ). Só `is_staff` com sessão MFA."""

from datetime import date, timedelta

from django.conf import settings
from django.db.models import Count, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import generics, permissions, serializers
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.models import AuditLog, record
from institutions.models import Institution
from ledger.models import Account, balance, trial_balance
from payments.models import DeadLetter, Method, Status, Transaction
from portal.api import (
    FILTERS,
    PAID,
    InviteSerializer,
    MemberSerializer,
    PortalTransactionSerializer,
    _since,
    _sum,
    add_member,
    filtered,
)
from reconciliation.models import Discrepancy, ReconciliationRun
from reconciliation.services import run_daily_reconciliation


class IsPlatformStaff(permissions.BasePermission):
    message = "Acesso reservado à equipa da plataforma (com MFA)."

    def has_permission(self, request, view):
        u = request.user
        if not (u.is_authenticated and u.is_staff):
            return False
        return not settings.PORTAL_REQUIRE_MFA or bool(request.session.get("mfa_ok"))


class StaffView(APIView):
    permission_classes = [IsPlatformStaff]


# ---------- Visão geral ----------


class Overview(StaffView):
    @extend_schema(responses=inline_serializer("Overview", {
        "today": serializers.DictField(), "month": serializers.DictField(),
        "commission_30d": serializers.IntegerField(), "success_rate_24h": serializers.FloatField(allow_null=True),
        "by_status_24h": serializers.DictField(), "institutions": serializers.DictField(),
        "ledger_balanced": serializers.BooleanField(), "in_transit": serializers.IntegerField(),
        "open_discrepancies": serializers.IntegerField(), "dead_letters": serializers.IntegerField(),
        "stuck_pending": serializers.IntegerField(),
        "top_institutions": serializers.ListField(child=serializers.DictField())}))  # fmt: skip
    def get(self, request):
        now = timezone.now()
        paid = Transaction.objects.filter(status__in=PAID)
        month = paid.filter(confirmed_at__gte=_since(30))
        day = Transaction.objects.filter(created_at__gte=now - timedelta(hours=24))
        by_status = dict(day.values_list("status").annotate(n=Count("id")))
        finished = sum(v for k, v in by_status.items() if k not in (Status.CREATED, Status.PENDING))
        ok = sum(by_status.get(s, 0) for s in (*PAID, Status.REVERSED))
        return Response({
            "today": _sum(paid.filter(confirmed_at__gte=_since(1))),
            "month": _sum(month),
            "commission_30d": month.aggregate(c=Sum("commission"))["c"] or 0,
            "success_rate_24h": round(ok / finished, 4) if finished else None,
            "by_status_24h": by_status,
            "institutions": dict(Institution.objects.values_list("status").annotate(n=Count("id"))),
            "ledger_balanced": trial_balance() == 0,
            "in_transit": balance(Account.PROVIDER_RECEIVABLE),
            "open_discrepancies": Discrepancy.objects.filter(resolved=False).count(),
            "dead_letters": DeadLetter.objects.filter(resolved=False).count(),
            "stuck_pending": Transaction.objects.filter(status=Status.PENDING, expires_at__lt=now).count(),
            "top_institutions": list(month.values("institution__name", "institution__slug")
                                     .annotate(count=Count("id"), gross=Sum("total")).order_by("-gross")[:5]),
        })  # fmt: skip


# ---------- Instituições ----------


class InstitutionAdminSerializer(serializers.ModelSerializer):
    volume_30d = serializers.IntegerField(read_only=True, default=0)
    count_30d = serializers.IntegerField(read_only=True, default=0)
    services = serializers.IntegerField(source="services.count", read_only=True)
    members = serializers.IntegerField(source="memberships.count", read_only=True)

    class Meta:
        model = Institution
        fields = [
            "id", "name", "slug", "nuit", "status", "settlement_bank", "settlement_account_masked",
            "commission_bps", "commission_fixed", "commission_payer", "is_demo", "logo", "created_at",
            "volume_30d", "count_30d", "services", "members",
        ]  # fmt: skip
        read_only_fields = ["id", "logo", "created_at"]

    def validate_nuit(self, v):
        if v and not (v.isdigit() and len(v) == 9):
            raise serializers.ValidationError("NUIT tem 9 dígitos.")
        return v

    def validate_settlement_account_masked(self, v):
        # Nunca guardar o número completo: só os últimos 4 dígitos.
        digits = "".join(c for c in v if c.isdigit())
        return f"****{digits[-4:]}" if digits else ""


class InstitutionList(generics.ListCreateAPIView):
    serializer_class = InstitutionAdminSerializer
    permission_classes = [IsPlatformStaff]
    pagination_class = None

    def get_queryset(self):
        paid30 = Q(transactions__status__in=PAID, transactions__confirmed_at__gte=_since(30))
        qs = Institution.objects.annotate(volume_30d=Sum("transactions__total", filter=paid30),
                                          count_30d=Count("transactions", filter=paid30)).order_by("name")  # fmt: skip
        if s := self.request.query_params.get("status"):
            qs = qs.filter(status=s)
        return qs

    def perform_create(self, serializer):
        inst = serializer.save(is_demo=settings.DEMO_MODE)
        record("institution.create", request=self.request, institution=inst, target=inst, slug=inst.slug)


class InstitutionDetail(generics.RetrieveUpdateAPIView):
    serializer_class = InstitutionAdminSerializer
    permission_classes = [IsPlatformStaff]
    queryset = Institution.objects.all()
    lookup_field = "slug"
    http_method_names = ["get", "patch"]

    def perform_update(self, serializer):
        before = {f: getattr(serializer.instance, f) for f in serializer.validated_data}
        inst = serializer.save()
        record("institution.update", request=self.request, institution=inst, target=inst,
               changes={f: [str(before[f]), str(getattr(inst, f))] for f in before})  # fmt: skip


def logo_data_url(f) -> str:
    """Só imagens reais; mantém a proporção e a transparência; até 256 px; WebP."""
    import base64
    import io

    from PIL import Image, ImageOps

    im = Image.open(f)
    if im.format not in ("JPEG", "PNG", "WEBP", "MPO"):
        raise ValueError("formato")
    im = ImageOps.exif_transpose(im).convert("RGBA")
    im.thumbnail((256, 256))
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=85)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


class InstitutionLogo(APIView):
    """POST multipart `logo` (JPG/PNG/WebP até 3 MB) define o logótipo; DELETE tira-o."""

    permission_classes = [IsPlatformStaff]
    parser_classes = [MultiPartParser]

    @extend_schema(
        request={
            "multipart/form-data": {"type": "object", "properties": {"logo": {"type": "string", "format": "binary"}}}
        },
        responses=inline_serializer("Logo", {"logo": serializers.CharField()}),
    )
    def post(self, request, slug):
        from PIL import Image

        inst = get_object_or_404(Institution, slug=slug)
        f = request.FILES.get("logo")
        if f is None or f.size > 3 * 1024 * 1024:
            return Response({"detail": "Escolha uma imagem até 3 MB."}, status=400)
        try:
            inst.logo = logo_data_url(f)
        except (OSError, ValueError, Image.DecompressionBombError):
            return Response({"detail": "Esta imagem não pode ser lida."}, status=400)
        inst.save(update_fields=["logo"])
        record("institution.logo", request=request, institution=inst, target=inst)
        return Response({"logo": inst.logo})

    @extend_schema(responses={204: None})
    def delete(self, request, slug):
        inst = get_object_or_404(Institution, slug=slug)
        inst.logo = ""
        inst.save(update_fields=["logo"])
        return Response(status=204)


class InstitutionAdmins(APIView):
    """O super admin junta o administrador (ou outra pessoa) a uma instituição; recebe o link de convite."""

    permission_classes = [IsPlatformStaff]

    @extend_schema(responses=MemberSerializer(many=True))
    def get(self, request, slug):
        inst = get_object_or_404(Institution, slug=slug)
        return Response(MemberSerializer(inst.memberships.select_related("user"), many=True).data)

    @extend_schema(request=InviteSerializer, responses={201: MemberSerializer})
    def post(self, request, slug):
        inst = get_object_or_404(Institution, slug=slug)
        s = InviteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        m, extra = add_member(request, inst, s.validated_data)
        if m is None:
            return Response(extra, status=409)
        return Response({**MemberSerializer(m).data, **extra}, status=201)


class ResendInvite(APIView):
    """Novo link para quem ainda não definiu a senha (ou se esqueceu dela)."""

    permission_classes = [IsPlatformStaff]

    @extend_schema(
        request=None,
        responses=inline_serializer(
            "Invite", {"invite_link": serializers.CharField(), "emailed": serializers.BooleanField()}
        ),
    )
    def post(self, request, pk):
        from accounts.invite import invite_link, send_invite
        from accounts.models import User

        user = get_object_or_404(User, pk=pk, is_active=True)
        record("auth.invite_resent", request=request, target=user)
        return Response({"invite_link": invite_link(user), "emailed": send_invite(user)})


# ---------- Transacções (todas as instituições) ----------


class StaffTransactionSerializer(PortalTransactionSerializer):
    institution_name = serializers.CharField(source="institution.name")

    class Meta(PortalTransactionSerializer.Meta):
        fields = ["institution_name", *PortalTransactionSerializer.Meta.fields]
        read_only_fields = fields


class Transactions(generics.ListAPIView):
    serializer_class = StaffTransactionSerializer
    permission_classes = [IsPlatformStaff]

    @extend_schema(parameters=[*FILTERS[:-1], OpenApiParameter("institution", str)])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        p = self.request.query_params
        qs = filtered(None, p).select_related("institution")
        return qs.filter(institution__slug=p["institution"]) if p.get("institution") else qs


# ---------- Reconciliação e falhas ----------


class DiscrepancyStaffSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source="get_kind_display")
    institution_name = serializers.CharField(source="institution.name", allow_null=True)
    business_date = serializers.DateField(source="run.business_date")

    class Meta:
        model = Discrepancy
        fields = ["id", "business_date", "kind", "kind_label", "institution_name", "reference", "provider_ref",
                  "platform_amount", "provider_amount", "detail", "resolved", "resolution_note"]  # fmt: skip
        read_only_fields = fields


class Discrepancies(generics.ListAPIView):
    serializer_class = DiscrepancyStaffSerializer
    permission_classes = [IsPlatformStaff]

    def get_queryset(self):
        qs = Discrepancy.objects.select_related("institution", "run").order_by("-run__business_date", "kind")
        return qs if self.request.query_params.get("all") else qs.filter(resolved=False)


class RunReconciliation(StaffView):
    @extend_schema(
        request=inline_serializer("RunRecon", {"date": serializers.DateField()}),
        responses=inline_serializer("RunReconResult", {"discrepancies": serializers.IntegerField()}),
    )
    def post(self, request):
        d = request.data.get("date") or timezone.localdate().isoformat()
        try:
            date.fromisoformat(d)
        except ValueError:
            return Response({"date": "Use AAAA-MM-DD."}, status=400)
        n = run_daily_reconciliation(d)
        record("reconciliation.run", request=request, date=d, divergencias=n)
        return Response({"discrepancies": n, "runs": ReconciliationRun.objects.count()})


class DeadLetterSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeadLetter
        fields = ["id", "created_at", "kind", "payload", "error", "resolved"]
        read_only_fields = fields


class DeadLetters(generics.ListAPIView):
    serializer_class = DeadLetterSerializer
    permission_classes = [IsPlatformStaff]

    def get_queryset(self):
        return DeadLetter.objects.filter(resolved=False).order_by("-created_at")


def _retry(dl: DeadLetter):
    """Volta a pôr na fila. Os handlers são idempotentes, por isso repetir é seguro."""
    from payments.tasks import deliver_simulated_webhook, notify_institution, reverse_at_institution

    if dl.kind.startswith("webhook:"):
        return deliver_simulated_webhook.delay(dl.kind.split(":", 1)[1], dl.payload)
    txn = get_object_or_404(Transaction, reference=dl.payload.get("reference"))
    task = {"connector:confirm": notify_institution, "connector:reverse": reverse_at_institution}[dl.kind]
    return task.delay(txn.pk)


class DeadLetterAction(StaffView):
    @extend_schema(request=inline_serializer("DLAction", {"action": serializers.ChoiceField(["retry", "resolve"])}),
                   responses=DeadLetterSerializer)  # fmt: skip
    def post(self, request, pk):
        dl = get_object_or_404(DeadLetter, pk=pk, resolved=False)
        action = request.data.get("action")
        if action == "retry":
            _retry(dl)
        elif action != "resolve":
            return Response({"action": "Use retry ou resolve."}, status=400)
        DeadLetter.objects.filter(pk=dl.pk).update(resolved=True)
        record(f"deadletter.{action}", request=request, target=dl, kind=dl.kind)
        dl.refresh_from_db()
        return Response(DeadLetterSerializer(dl).data)


# ---------- Auditoria ----------


def _target_label(kind: str, pk: str) -> str:
    """Nome legível do objecto: referência do pagamento, nome da pessoa, nome da instituição..."""
    from accounts.models import User
    from institutions.models import Membership
    from payments.models import Complaint

    try:
        if kind == "Transaction":
            return Transaction.objects.only("reference").get(pk=pk).reference
        if kind == "User":
            u = User.objects.get(pk=pk)
            return u.get_full_name() or u.email or u.phone or ""
        if kind == "Institution":
            return Institution.objects.only("name").get(pk=pk).name
        if kind == "Membership":
            m = Membership.objects.select_related("user").get(pk=pk)
            return m.user.get_full_name() or m.user.email or m.user.phone or ""
        if kind == "Complaint":
            return f"Reclamação de {Complaint.objects.select_related('transaction').get(pk=pk).transaction.reference}"
    except Exception:  # noqa: BLE001 - objecto apagado ou id estranho: fica o tipo e o número
        pass
    return f"{kind} {pk}".strip()


class AuditSerializer(serializers.ModelSerializer):
    actor_phone = serializers.CharField(source="actor.phone", allow_null=True, default=None)
    actor_name = serializers.SerializerMethodField()
    institution_name = serializers.CharField(source="institution.name", allow_null=True, default=None)
    target_label = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = ["id", "created_at", "action", "actor_phone", "actor_name", "institution_name", "target_type",
                  "target_id", "target_label", "data", "ip"]  # fmt: skip
        read_only_fields = fields

    def get_actor_name(self, e) -> str | None:
        u = e.actor
        return (u.get_full_name() or u.email or u.phone) if u else None

    def get_target_label(self, e) -> str:
        return _target_label(e.target_type, e.target_id) if e.target_type else ""


class Audit(generics.ListAPIView):
    serializer_class = AuditSerializer
    permission_classes = [IsPlatformStaff]

    @extend_schema(parameters=[OpenApiParameter("action", str, description="prefixo, ex. payment."),
                               OpenApiParameter("institution", str), OpenApiParameter("actor", str)])  # fmt: skip
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        p = self.request.query_params
        qs = AuditLog.objects.select_related("actor", "institution")
        if v := p.get("action"):
            qs = qs.filter(action__startswith=v)
        if v := p.get("institution"):
            qs = qs.filter(institution__slug=v)
        if v := p.get("actor"):
            qs = qs.filter(
                Q(actor__phone__contains=v)
                | Q(actor__email__icontains=v)
                | Q(actor__first_name__icontains=v)
                | Q(actor__last_name__icontains=v)
            )
        return qs


# ---------- Provedores ----------


class Providers(StaffView):
    @extend_schema(responses=inline_serializer("ProviderHealth", {
        "method": serializers.CharField(), "label": serializers.CharField(), "adapter": serializers.CharField(),
        "total_24h": serializers.IntegerField(), "success_rate_24h": serializers.FloatField(allow_null=True),
        "pending": serializers.IntegerField()}, many=True))  # fmt: skip
    def get(self, request):
        from payments.providers import PROVIDERS

        since = timezone.now() - timedelta(hours=24)
        out = []
        for m, label in Method.choices:
            qs = Transaction.objects.filter(method=m, created_at__gte=since)
            done = qs.exclude(status__in=[Status.CREATED, Status.PENDING])
            ok = done.filter(status__in=[*PAID, Status.REVERSED]).count()
            n = done.count()
            out.append({"method": m, "label": label, "adapter": type(PROVIDERS[m]).__name__, "total_24h": qs.count(),
                        "success_rate_24h": round(ok / n, 4) if n else None,
                        "pending": qs.filter(status=Status.PENDING).count()})  # fmt: skip
        return Response(out)


# ---------- Parâmetros (só leitura; alteram-se por variáveis de ambiente) ----------


class Parameters(StaffView):
    @extend_schema(responses=inline_serializer("Parameters", {"items": serializers.DictField()}))
    def get(self, request):
        keys = ["DEMO_MODE", "PAYMENT_EXPIRY_MINUTES", "PORTAL_REQUIRE_MFA", "PUBLIC_WEB_URL", "TIME_ZONE",
                "CELERY_TASK_ALWAYS_EAGER"]  # fmt: skip
        return Response({"items": {k: getattr(settings, k) for k in keys}})
