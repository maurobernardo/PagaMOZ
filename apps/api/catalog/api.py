from django.db.models import Count, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_field, extend_schema_view
from rest_framework import generics, mixins, permissions, serializers, viewsets

from audit.models import record
from institutions.models import Institution, Membership
from institutions.permissions import InstitutionRole, resolve_membership

from .models import Category, Service

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
    variants = serializers.SerializerMethodField(help_text="Modalidades com preço próprio.")

    def get_lookup(self, obj) -> bool:
        return obj.pricing == "consulta" or bool((obj.connector_config or {}).get("profile"))

    @extend_schema_field(Variant(many=True))
    def get_variants(self, obj):
        return list((obj.connector_config or {}).get("variants", []))

    def get_guide(self, obj) -> list[str]:
        return list((obj.connector_config or {}).get("guide", []))

    class Meta:
        model = Service
        fields = [
            "id", "name", "slug", "description", "institution", "category", "integration_level",
            "pricing", "amount", "min_amount", "max_amount", "fields", "lookup", "guide", "variants",
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


class MeSerializer(serializers.Serializer):
    phone = serializers.CharField()
    name = serializers.CharField(source="get_full_name")
    memberships = MembershipSerializer(many=True)
    is_staff = serializers.BooleanField()


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
            qs = qs.filter(Q(name__icontains=q) | Q(description__icontains=q) | Q(institution__name__icontains=q))
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


class Me(generics.RetrieveAPIView):
    serializer_class = MeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user
