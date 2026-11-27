import json
from pathlib import Path

from django.db.models import Case, Count, IntegerField, Q, When
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_field, extend_schema_view
from rest_framework import generics, mixins, permissions, serializers, viewsets

from audit.models import record
from institutions.models import Institution, Membership
from institutions.permissions import InstitutionRole, resolve_membership
from intel.models import log

from .models import Category, Service
from .search import rank

# ---------- Serializers ----------


class CategorySerializer(serializers.ModelSerializer):
    service_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "description", "icon", "order", "service_count"]
        read_only_fields = fields


class InstitutionPublicSerializer(serializers.ModelSerializer):
    # Endereço curto: a imagem não vai repetida em cada serviço. Vazio = logótipo do site ou iniciais.
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Institution
        fields = ["id", "name", "slug", "is_demo", "logo_url"]
        read_only_fields = fields

    def get_logo_url(self, inst) -> str:
        if not inst.logo:
            return ""
        import hashlib

        return f"/api/catalog/institutions/{inst.slug}/logo?v={hashlib.md5(inst.logo.encode()).hexdigest()[:8]}"


def institution_logo(request, slug):
    """Logótipo carregado no backoffice, como imagem (com cache longa: o ?v= muda quando o logótipo muda)."""
    import base64

    from django.http import Http404, HttpResponse

    inst = Institution.objects.filter(slug=slug).only("logo").first()
    if not inst or not inst.logo.startswith("data:image/webp;base64,"):
        raise Http404
    r = HttpResponse(base64.b64decode(inst.logo.split(",", 1)[1]), content_type="image/webp")
    # Com ?v= (muda quando o logótipo muda) guarda-se um ano; sem ele, 5 minutos.
    long = "public, max-age=31536000, immutable"
    r["Cache-Control"] = long if request.GET.get("v") else "public, max-age=300"
    return r


class ServiceField(serializers.Serializer):
    name = serializers.SlugField()
    label = serializers.CharField(max_length=80)
    type = serializers.ChoiceField(["text", "number", "date", "phone", "file", "select"])
    required = serializers.BooleanField(default=True)
    pattern = serializers.CharField(required=False, allow_blank=True)
    help = serializers.CharField(required=False, allow_blank=True)
    options = serializers.ListField(child=serializers.DictField(child=serializers.CharField()), required=False)


class Variant(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    amount = serializers.IntegerField()
    hint = serializers.CharField(required=False, allow_blank=True)


class ServicePublicSerializer(serializers.ModelSerializer):
    institution = InstitutionPublicSerializer(read_only=True)
    category = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    fields = ServiceField(many=True, read_only=True)

    lookup = serializers.SerializerMethodField(help_text="Há consulta à instituição antes de pagar.")
    guide = serializers.SerializerMethodField(help_text="Notas do processo (presencial, prazos…).")
    group = serializers.SerializerMethodField(help_text="Assunto comum a várias opções (ex.: recarga por operadora).")
    variants = serializers.SerializerMethodField(help_text="Modalidades com preço próprio.")
    deposit = serializers.SerializerMethodField(help_text="Depósito na conta da instituição (banco, conta, titular).")

    @extend_schema_field({"type": "object", "nullable": True, "properties": {
        k: {"type": "string"} for k in ("bank", "account", "holder")}})  # fmt: skip
    def get_deposit(self, obj):
        if not obj.is_deposit:
            return None
        return {"bank": obj.deposit_bank, "account": obj.deposit_account, "holder": obj.deposit_holder}

    def get_lookup(self, obj) -> bool:
        return obj.pricing == "consulta" or bool((obj.connector_config or {}).get("profile"))

    @extend_schema_field(Variant(many=True))
    def get_variants(self, obj):
        return list((obj.connector_config or {}).get("variants", []))

    @extend_schema_field({"type": "object", "nullable": True, "required": ["key", "title", "prompt", "option"],
        "properties": {k: {"type": "string"} for k in ("key", "title", "prompt", "option")}})  # fmt: skip
    def get_group(self, obj):
        from .demo_data import GROUPS

        cfg = obj.connector_config or {}
        g = GROUPS.get(cfg.get("group", ""))
        return {"key": cfg["group"], "title": g[0], "prompt": g[1], "option": cfg.get("option", "")} if g else None

    def get_guide(self, obj) -> list[str]:
        return list((obj.connector_config or {}).get("guide", []))

    class Meta:
        model = Service
        fields = [
            "id", "name", "slug", "description", "institution", "category", "integration_level",
            "pricing", "amount", "min_amount", "max_amount", "fields", "lookup", "guide", "variants", "group",
            "deposit",
        ]  # fmt: skip
        read_only_fields = fields


class ServicePortalSerializer(serializers.ModelSerializer):
    category = serializers.SlugRelatedField(slug_field="slug", queryset=Category.objects.all())
    fields = ServiceField(many=True, required=False)

    class Meta:
        model = Service
        fields = [
            "id", "name", "slug", "description", "category", "integration_level", "pricing",
            "amount", "min_amount", "max_amount", "fields", "is_active",
            "commission_bps", "commission_fixed", "commission_payer", "updated_at",
            "deposit_bank", "deposit_account", "deposit_holder",
        ]  # fmt: skip
        read_only_fields = ["updated_at", "deposit_bank", "deposit_account", "deposit_holder"]

    def validate(self, attrs):
        inst = Service(**{**self._current(), **attrs})
        inst.clean()  # mesmas regras do modelo; o DRF converte a ValidationError do Django
        return attrs

    def _current(self):
        if not self.instance:
            return {}
        return {f: getattr(self.instance, f) for f in ("pricing", "amount", "min_amount", "max_amount")}


class MembershipSerializer(serializers.ModelSerializer):
    institution = InstitutionPublicSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ["institution", "role"]


# Províncias e distritos oficiais (Lei 26/2013; ver accounts/districts.json).
DISTRICTS: dict[str, list[str]] = json.loads(
    (Path(__file__).resolve().parent.parent / "accounts" / "districts.json").read_text("utf-8")
)["provincias"]
PROVINCES = list(DISTRICTS)


class MeSerializer(serializers.Serializer):
    phone = serializers.CharField(read_only=True)
    name = serializers.CharField(source="get_full_name", read_only=True)
    first_name = serializers.CharField(max_length=60, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=60, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    province = serializers.ChoiceField([*PROVINCES, ""], required=False)
    district = serializers.CharField(max_length=60, required=False, allow_blank=True)
    avatar = serializers.CharField(read_only=True)
    memberships = MembershipSerializer(many=True, read_only=True)
    is_staff = serializers.BooleanField(read_only=True)

    def validate(self, attrs):
        prov = attrs.get("province", getattr(self.instance, "province", ""))
        dist = attrs.get("district", getattr(self.instance, "district", ""))
        if dist and dist not in DISTRICTS.get(prov, []):
            raise serializers.ValidationError({"district": "Escolha um distrito da província indicada."})
        return attrs

    def update(self, instance, validated):
        for k, v in validated.items():
            setattr(instance, k, v.strip() if isinstance(v, str) else v)
        instance.save(update_fields=list(validated))
        return instance


# ---------- Público (cidadão) ----------


def _public_services():
    return Service.objects.filter(is_active=True, institution__status=Institution.Status.ACTIVE)


class CategoryList(generics.ListAPIView):
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        qs = Category.objects.annotate(service_count=Count("services", filter=Q(services__in=_public_services())))
        return qs.order_by("order")


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter("category", str, description="slug da categoria"),
            OpenApiParameter("institution", str, description="slug da instituição"),
            OpenApiParameter("q", str, description="pesquisa livre"),
        ]
    )
)
class PublicServiceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ServicePublicSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = _public_services().select_related("institution", "category")
        p = self.request.query_params
        if cat := p.get("category"):
            qs = qs.filter(category__slug=cat)
        if inst := p.get("institution"):
            qs = qs.filter(institution__slug=inst)
        if q := p.get("q", "").strip():
            # Pesquisa inteligente (siglas, sinónimos, erros de escrita), ordenada por relevância.
            ids = [x.pk for x in rank(qs, q)]
            log("search", self.request, q=q[:80], results=len(ids))
            order = Case(*[When(pk=pk, then=i) for i, pk in enumerate(ids)], output_field=IntegerField())
            qs = qs.filter(pk__in=ids).order_by(order) if ids else qs.none()
        return qs


# ---------- Portal da instituição (multi-tenant) ----------


class PortalServiceViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):  # fmt: skip
    """Serviços da instituição do URL. Nunca devolve serviços de outra instituição."""

    serializer_class = ServicePortalSerializer
    permission_classes = [permissions.IsAuthenticated, InstitutionRole]
    write_roles = {Membership.Role.ADMIN}

    @property
    def institution(self):
        return resolve_membership(self.request, self.kwargs["institution_slug"]).institution

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # geração do schema OpenAPI
            return Service.objects.none()
        return Service.objects.filter(institution=self.institution).select_related("category")

    def perform_create(self, serializer):
        obj = serializer.save(institution=self.institution)
        record("service.create", request=self.request, institution=self.institution, target=obj, slug=obj.slug)

    def perform_update(self, serializer):
        changed = sorted(serializer.validated_data)
        obj = serializer.save()
        record("service.update", request=self.request, institution=self.institution, target=obj, fields=changed)


class Me(generics.RetrieveUpdateAPIView):
    """O próprio utilizador. PATCH actualiza o perfil (nome, email, província, distrito)."""

    http_method_names = ["get", "patch", "delete", "head", "options"]

    def delete(self, request, *args, **kwargs):
        return self.destroy(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Apagar a conta: os dados pessoais saem.

        Os pagamentos ficam (são a prova), mas deixam de estar ligados à pessoa.
        """
        from django.contrib.auth import logout
        from rest_framework.response import Response

        from accounts.models import PushDevice, SavedObligation
        from audit.models import record
        from payments.models import Transaction

        u = request.user
        record("account.delete", request=request, target=u)
        Transaction.objects.filter(user=u).update(user=None)
        SavedObligation.objects.filter(user=u).delete()
        PushDevice.objects.filter(user=u).delete()
        u.phone = f"+25800{u.pk:07d}"[:13]  # número fictício: liberta o verdadeiro para uma conta nova
        u.first_name = u.last_name = u.email = u.province = u.district = u.avatar = ""
        u.is_active = False
        u.set_unusable_password()
        u.save()
        logout(request)
        return Response(status=204)

    serializer_class = MeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user
