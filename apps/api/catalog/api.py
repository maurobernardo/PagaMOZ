import json
from pathlib import Path

from django.db.models import Case, Count, IntegerField, Q, When
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_field, extend_schema_view
from rest_framework import generics, mixins, permissions, serializers, viewsets

from audit.models import record
from institutions.models import Institution, Membership
from institutions.permissions import InstitutionRole, resolve_membership

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
    class Meta:
        model = Institution
        fields = ["id", "name", "slug", "is_demo"]
        read_only_fields = fields


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
        ]  # fmt: skip
        read_only_fields = ["updated_at"]

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

    http_method_names = ["get", "patch", "head", "options"]

    serializer_class = MeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user
