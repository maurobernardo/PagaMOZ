"""Portal da instituição: tudo filtrado pela instituição do URL (resolve_membership)."""

import csv
import io
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db import IntegrityError
from django.db import transaction as db
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_field, inline_serializer
from rest_framework import generics, permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.api import PhoneField
from accounts.models import User
from audit.models import record
from institutions.models import Membership
from institutions.permissions import InstitutionRole, resolve_membership
from ledger.models import Account, balance
from payments.domain import InvalidTransition, transition
from payments.models import Method, Status, Transaction
from reconciliation.models import Discrepancy, ReconciliationRun
from servicerequests.models import RequestStatus

MAPUTO = ZoneInfo("Africa/Maputo")
PAID = [Status.CONFIRMED, Status.SETTLED, Status.DISPUTED]
R = Membership.Role


class PortalView(APIView):
    permission_classes = [permissions.IsAuthenticated, InstitutionRole]

    def institution(self):
        return resolve_membership(self.request, self.kwargs["institution_slug"]).institution


def _since(days: int):
    today = timezone.localdate()
    return datetime.combine(today - timedelta(days=days - 1), time.min, tzinfo=MAPUTO)


def _sum(qs):
    a = qs.aggregate(n=Count("id"), gross=Sum("total"), net=Sum("institution_net"))
    return {"count": a["n"], "gross": a["gross"] or 0, "net": a["net"] or 0}


# ---------- Dashboard ----------


class Dashboard(PortalView):
    @extend_schema(
        responses=inline_serializer(
            "Dashboard",
            {
                "today": serializers.DictField(),
                "week": serializers.DictField(),
                "month": serializers.DictField(),
                "by_service": serializers.ListField(child=serializers.DictField()),
                "by_method": serializers.ListField(child=serializers.DictField()),
                "daily": serializers.ListField(child=serializers.DictField()),
                "balances": serializers.DictField(),
                "pending_requests": serializers.IntegerField(),
                "open_discrepancies": serializers.IntegerField(),
            },
        )
    )
    def get(self, request, institution_slug):
        inst = self.institution()
        paid = Transaction.objects.filter(institution=inst, status__in=PAID)
        month = paid.filter(confirmed_at__gte=_since(30))
        daily = {
            r["d"]: r
            for r in month.annotate(d=TruncDate("confirmed_at", tzinfo=MAPUTO))
            .values("d")
            .annotate(count=Count("id"), net=Sum("institution_net"))
            .order_by("d")
        }
        days = [timezone.localdate() - timedelta(days=i) for i in range(29, -1, -1)]
        methods = dict(Method.choices)
        return Response(
            {
                "today": _sum(paid.filter(confirmed_at__gte=_since(1))),
                "week": _sum(paid.filter(confirmed_at__gte=_since(7))),
                "month": _sum(month),
                "by_service": list(
                    month.values("service__name")
                    .annotate(count=Count("id"), net=Sum("institution_net"))
                    .order_by("-net")[:8]
                ),
                "by_method": [
                    {"method": r["method"], "label": methods[r["method"]], "count": r["count"], "net": r["net"]}
                    for r in month.values("method")
                    .annotate(count=Count("id"), net=Sum("institution_net"))
                    .order_by("-net")
                ],
                "daily": [
                    {
                        "date": d.isoformat(),
                        "count": daily.get(d, {}).get("count", 0),
                        "net": daily.get(d, {}).get("net") or 0,
                    }
                    for d in days
                ],
                "balances": {
                    "a_liquidar": -balance(Account.INSTITUTION_PAYABLE, inst),
                    "liquidado_30d": inst.settlements.filter(business_date__gte=days[0]).aggregate(s=Sum("net"))["s"]
                    or 0,
                    "conta_destino": f"{inst.settlement_bank} {inst.settlement_account_masked}".strip(),
                },
                "pending_requests": inst.requests.filter(
                    status__in=[RequestStatus.SUBMITTED, RequestStatus.IN_REVIEW, RequestStatus.NEEDS_INFO]
                ).count(),
                "open_discrepancies": Discrepancy.objects.filter(institution=inst, resolved=False).count(),
            }
        )


# ---------- Transacções ----------


class PortalTransactionSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name")
    method_label = serializers.CharField(source="get_method_display")
    settlement_date = serializers.DateField(source="settlement.business_date", allow_null=True)

    class Meta:
        model = Transaction
        fields = [
            "reference",
            "status",
            "service",
            "service_name",
            "description",
            "method",
            "method_label",
            "amount",
            "commission",
            "commission_payer",
            "total",
            "institution_net",
            "provider_ref",
            "institution_ref",
            "created_at",
            "confirmed_at",
            "settled_at",
            "settlement_date",
            "failure_reason",
        ]
        read_only_fields = fields


FILTERS = [
    OpenApiParameter("status", str),
    OpenApiParameter("method", str),
    OpenApiParameter("service", int),
    OpenApiParameter("date_from", str, description="AAAA-MM-DD"),
    OpenApiParameter("date_to", str),
    OpenApiParameter("q", str, description="referência"),
    OpenApiParameter("export", str, enum=["csv", "xlsx"]),
]


def filtered(inst, p):
    """inst=None só no backoffice (todas as instituições); o portal passa sempre a sua."""
    qs = Transaction.objects.select_related("service", "settlement")
    if inst is not None:
        qs = qs.filter(institution=inst)
    if v := p.get("status"):
        qs = qs.filter(status__in=v.split(","))
    if v := p.get("method"):
        qs = qs.filter(method=v)
    if (v := p.get("service")) and v.isdigit():
        qs = qs.filter(service_id=int(v))
    try:
        if v := p.get("date_from"):
            qs = qs.filter(created_at__gte=datetime.combine(date.fromisoformat(v), time.min, tzinfo=MAPUTO))
        if v := p.get("date_to"):
            qs = qs.filter(created_at__lte=datetime.combine(date.fromisoformat(v), time.max, tzinfo=MAPUTO))
    except ValueError:
        raise serializers.ValidationError({"date": "Use AAAA-MM-DD."}) from None
    if v := p.get("q", "").strip():
        qs = qs.filter(Q(reference__icontains=v) | Q(description__icontains=v))
    return qs


EXPORT_COLS = [
    ("Referência", lambda t: t.reference),
    ("Estado", lambda t: t.status),
    ("Serviço", lambda t: t.service.name),
    ("Detalhe", lambda t: t.description),
    ("Método", lambda t: t.get_method_display()),
    ("Valor (MT)", lambda t: t.amount / 100),
    ("Comissão (MT)", lambda t: t.commission / 100),
    ("Total pago (MT)", lambda t: t.total / 100),
    ("Líquido instituição (MT)", lambda t: t.institution_net / 100),
    ("Criada", lambda t: timezone.localtime(t.created_at).strftime("%Y-%m-%d %H:%M")),
    ("Confirmada", lambda t: timezone.localtime(t.confirmed_at).strftime("%Y-%m-%d %H:%M") if t.confirmed_at else ""),
    ("Liquidada (lote)", lambda t: t.settlement.business_date.isoformat() if t.settlement else ""),
    ("Ref. provedor", lambda t: t.provider_ref),
    ("Ref. instituição", lambda t: t.institution_ref),
]
MAX_EXPORT = 50_000


def _safe(v):
    # Evita injecção de fórmulas ao abrir no Excel (=, +, -, @).
    return "'" + v if isinstance(v, str) and v[:1] in ("=", "+", "-", "@") else v


def export(qs, fmt: str, slug: str) -> HttpResponse:
    rows = ([_safe(f(t)) for _, f in EXPORT_COLS] for t in qs.iterator(chunk_size=2000))
    stamp = timezone.localdate().isoformat()
    if fmt == "xlsx":
        from openpyxl import Workbook

        wb = Workbook(write_only=True)
        ws = wb.create_sheet("Transacções")
        ws.append([c for c, _ in EXPORT_COLS])
        for r in rows:
            ws.append(r)
        buf = io.BytesIO()
        wb.save(buf)
        resp = HttpResponse(
            buf.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    else:
        buf = io.StringIO()
        w = csv.writer(buf, delimiter=";")  # ";" + BOM: abre bem no Excel em pt
        w.writerow([c for c, _ in EXPORT_COLS])
        w.writerows(rows)
        resp = HttpResponse("﻿" + buf.getvalue(), content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="transaccoes-{slug}-{stamp}.{fmt}"'
    return resp


class PortalTransactions(generics.ListAPIView):
    serializer_class = PortalTransactionSerializer
    permission_classes = [permissions.IsAuthenticated, InstitutionRole]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Transaction.objects.none()
        inst = resolve_membership(self.request, self.kwargs["institution_slug"]).institution
        return filtered(inst, self.request.query_params)

    @extend_schema(parameters=FILTERS)
    def get(self, request, *args, **kwargs):
        fmt = request.query_params.get("export")
        if fmt in ("csv", "xlsx"):
            qs = self.get_queryset()
            if qs.count() > MAX_EXPORT:
                return Response({"detail": f"Mais de {MAX_EXPORT} linhas: reduza o período."}, status=400)
            record(
                "transactions.export",
                request=request,
                institution=qs.first().institution if qs else None,
                formato=fmt,
                linhas=qs.count(),
            )
            return export(qs, fmt, kwargs["institution_slug"])
        return super().get(request, *args, **kwargs)


class ReverseRequest(serializers.Serializer):
    reason = serializers.CharField(min_length=5, max_length=200)


class PortalReverse(PortalView):
    """Estorno antes da liquidação (admin/financeiro)."""

    write_roles = {R.ADMIN, R.FINANCE}

    @extend_schema(request=ReverseRequest, responses=PortalTransactionSerializer)
    def post(self, request, institution_slug, reference):
        txn = get_object_or_404(Transaction, institution=self.institution(), reference=reference)
        s = ReverseRequest(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            transition(txn.pk, Status.REVERSED, reason=s.validated_data["reason"], actor=request.user)
        except InvalidTransition:
            return Response(
                {"detail": "Só é possível devolver pagamentos confirmados e ainda não liquidados."}, status=409
            )
        txn.refresh_from_db()
        return Response(PortalTransactionSerializer(txn).data)


# ---------- Reconciliação ----------


class DiscrepancySerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source="get_kind_display")

    suggestion = serializers.SerializerMethodField()

    @extend_schema_field(
        {
            "type": "object",
            "nullable": True,
            "properties": {
                "text": {"type": "string"},
                "confidence": {"type": "number"},
                "pair": {"type": "integer"},
                "action": {"type": "string"},
            },
        }
    )
    def get_suggestion(self, obj):
        from reconciliation.suggest import suggest

        return suggest(obj, self.context.get("siblings", []))

    class Meta:
        model = Discrepancy
        fields = [
            "id",
            "kind",
            "kind_label",
            "suggestion",
            "reference",
            "provider_ref",
            "platform_amount",
            "provider_amount",
            "detail",
            "resolved",
            "resolution_note",
        ]
        read_only_fields = fields


class PortalReconciliation(PortalView):
    @extend_schema(
        parameters=[OpenApiParameter("date", str, description="AAAA-MM-DD (omissão: última reconciliação)")],
        responses=inline_serializer(
            "Reconciliation",
            {
                "date": serializers.DateField(allow_null=True),
                "ran_at": serializers.DateTimeField(allow_null=True),
                "platform_count": serializers.IntegerField(),
                "matched": serializers.IntegerField(),
                "items": DiscrepancySerializer(many=True),
                "runs": serializers.ListField(child=serializers.DictField()),
            },
        ),
    )
    def get(self, request, institution_slug):
        inst = self.institution()
        runs = ReconciliationRun.objects.all()[:30]
        d = request.query_params.get("date")
        try:
            day = date.fromisoformat(d) if d else None
        except ValueError:
            return Response({"date": "Use AAAA-MM-DD."}, status=400)
        run = ReconciliationRun.objects.filter(business_date=day).first() if day else ReconciliationRun.objects.first()
        if run is None:
            return Response({"date": None, "ran_at": None, "platform_count": 0, "matched": 0, "items": [], "runs": []})
        mine = Transaction.objects.filter(institution=inst, reference__in=run.items.values("reference"))
        items = run.items.filter(Q(institution=inst) | Q(reference__in=mine.values("reference")))
        from reconciliation.services import platform_txns

        count = platform_txns(run.business_date).filter(institution=inst).count()
        return Response(
            {
                "date": run.business_date,
                "ran_at": run.ran_at,
                "platform_count": count,
                "matched": count - items.exclude(kind=Discrepancy.Kind.MISSING_AT_PLATFORM).count(),
                "items": DiscrepancySerializer(
                    items, many=True, context={"siblings": list(items.select_related("institution"))}
                ).data,
                "runs": [
                    {"date": r.business_date, "discrepancies": r.items.filter(institution=inst).count()} for r in runs
                ],
            }
        )


class ResolveRequest(serializers.Serializer):
    note = serializers.CharField(min_length=5, max_length=300)


class PortalResolveDiscrepancy(PortalView):
    write_roles = {R.ADMIN, R.FINANCE}

    @extend_schema(request=ResolveRequest, responses=DiscrepancySerializer)
    def post(self, request, institution_slug, pk):
        item = get_object_or_404(Discrepancy, pk=pk, institution=self.institution())
        s = ResolveRequest(data=request.data)
        s.is_valid(raise_exception=True)
        item.resolved, item.resolution_note = True, s.validated_data["note"]
        item.save(update_fields=["resolved", "resolution_note"])
        record(
            "reconciliation.resolve",
            request=request,
            institution=item.institution,
            target=item,
            nota=item.resolution_note,
        )
        return Response(DiscrepancySerializer(item).data)


# ---------- Equipa ----------


class MemberSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(source="user.phone", read_only=True)
    name = serializers.CharField(source="user.get_full_name", read_only=True)
    mfa_enabled = serializers.BooleanField(source="user.mfa_enabled", read_only=True)

    class Meta:
        model = Membership
        fields = ["id", "phone", "name", "role", "mfa_enabled", "created_at"]
        read_only_fields = ["id", "phone", "name", "mfa_enabled", "created_at"]


class InviteSerializer(serializers.Serializer):
    phone = PhoneField()
    name = serializers.CharField(max_length=80, required=False, allow_blank=True)
    role = serializers.ChoiceField(R.choices)


class PortalMembers(PortalView):
    @extend_schema(responses=MemberSerializer(many=True))
    def get(self, request, institution_slug):
        qs = self.institution().memberships.select_related("user").order_by("role", "user__phone")
        return Response(MemberSerializer(qs, many=True).data)

    @extend_schema(request=InviteSerializer, responses={201: MemberSerializer})
    def post(self, request, institution_slug):
        inst = self.institution()
        s = InviteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        user = User.objects.filter(phone=d["phone"]).first() or User.objects.create_user(
            d["phone"], first_name=d.get("name", "")
        )
        try:
            with db.atomic():  # savepoint: o pedido continua utilizável depois do conflito
                m = Membership.objects.create(user=user, institution=inst, role=d["role"])
        except IntegrityError:
            return Response({"detail": "Esta pessoa já faz parte da equipa."}, status=409)
        record("member.add", request=request, institution=inst, target=m, phone=user.phone, role=m.role)
        # ponytail: convite sem canal (SMS/e-mail); o admin da plataforma define a palavra-passe inicial.
        return Response(MemberSerializer(m).data, status=201)


class RoleChange(serializers.Serializer):
    role = serializers.ChoiceField(R.choices)


class PortalMember(PortalView):
    def _get(self, pk):
        return get_object_or_404(Membership.objects.select_related("user"), pk=pk, institution=self.institution())

    def _last_admin(self, m):
        return m.role == R.ADMIN and not m.institution.memberships.filter(role=R.ADMIN).exclude(pk=m.pk).exists()

    @extend_schema(request=RoleChange, responses=MemberSerializer)
    def patch(self, request, institution_slug, pk):
        m = self._get(pk)
        s = RoleChange(data=request.data)
        s.is_valid(raise_exception=True)
        if self._last_admin(m) and s.validated_data["role"] != R.ADMIN:
            return Response({"detail": "Tem de existir pelo menos um administrador."}, status=409)
        old, m.role = m.role, s.validated_data["role"]
        m.save(update_fields=["role"])
        record("member.role", request=request, institution=m.institution, target=m, de=old, para=m.role)
        return Response(MemberSerializer(m).data)

    @extend_schema(responses={204: None})
    def delete(self, request, institution_slug, pk):
        m = self._get(pk)
        if self._last_admin(m):
            return Response({"detail": "Tem de existir pelo menos um administrador."}, status=409)
        record("member.remove", request=request, institution=m.institution, target=m, phone=m.user.phone)
        m.delete()
        return Response(status=204)
