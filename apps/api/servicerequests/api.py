import json

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, permissions, serializers
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.api import _public_services
from institutions.models import Membership
from institutions.permissions import InstitutionRole, resolve_membership
from payments.domain import PaymentError

from .domain import RequestError, create_request, set_status
from .models import Attachment, RequestEvent, RequestStatus, ServiceRequest


class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = RequestEvent
        fields = ["status", "note", "created_at"]


class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = ["id", "field", "original_name", "content_type", "size", "sha256", "created_at"]


class RequestPublicSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name")
    institution_name = serializers.CharField(source="institution.name")
    amount = serializers.IntegerField(source="service.amount")
    events = EventSerializer(many=True)

    class Meta:
        model = ServiceRequest
        fields = ["code", "status", "service", "service_name", "institution_name", "amount", "created_at",
                  "updated_at", "events"]  # fmt: skip


class RequestPortalSerializer(RequestPublicSerializer):
    attachments = AttachmentSerializer(many=True)

    class Meta(RequestPublicSerializer.Meta):
        fields = [*RequestPublicSerializer.Meta.fields, "form", "applicant_phone", "attachments"]


# ---------- Cidadão ----------


class RequestCreate(APIView):
    """multipart: `service`, `fields` (JSON), e um ficheiro por cada campo do tipo file."""

    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        request={"multipart/form-data": inline_serializer("RequestCreate", {
            "service": serializers.IntegerField(), "fields": serializers.CharField(help_text="JSON"),
            "applicant_phone": serializers.CharField(required=False)})},
        responses={201: RequestPublicSerializer},
    )  # fmt: skip
    def post(self, request):
        service = get_object_or_404(_public_services(), pk=request.data.get("service"))
        try:
            form = json.loads(request.data.get("fields") or "{}")
            if not isinstance(form, dict):
                raise ValueError
        except ValueError:
            return Response({"fields": "JSON inválido."}, status=400)
        try:
            req = create_request(service, form, dict(request.FILES.items()),
                                 user=request.user if request.user.is_authenticated else None,
                                 phone=request.data.get("applicant_phone", ""))  # fmt: skip
        except (RequestError, PaymentError) as e:
            msg = e.args[0]
            return Response({"detail": msg} if isinstance(msg, str) else {"fields": msg}, status=400)
        return Response(RequestPublicSerializer(req).data, status=201)


class RequestDetail(generics.RetrieveAPIView):
    """O código (~50 bits aleatórios) dá acesso ao estado; formulário e anexos não são expostos."""

    permission_classes = [permissions.AllowAny]
    serializer_class = RequestPublicSerializer
    lookup_field = "code"
    queryset = ServiceRequest.objects.select_related("service", "institution").prefetch_related("events")


# ---------- Portal da instituição ----------


class _PortalMixin:
    permission_classes = [permissions.IsAuthenticated, InstitutionRole]
    write_roles = {Membership.Role.ADMIN, Membership.Role.OPERATOR}

    def institution(self):
        return resolve_membership(self.request, self.kwargs["institution_slug"]).institution

    def base_qs(self):
        if getattr(self, "swagger_fake_view", False):
            return ServiceRequest.objects.none()
        return ServiceRequest.objects.filter(institution=self.institution()).select_related("service", "institution")


class PortalRequestList(_PortalMixin, generics.ListAPIView):
    serializer_class = RequestPublicSerializer

    def get_queryset(self):
        qs = self.base_qs().prefetch_related("events")
        if st := self.request.query_params.get("status"):
            qs = qs.filter(status=st)
        return qs


class PortalRequestDetail(_PortalMixin, generics.RetrieveAPIView):
    serializer_class = RequestPortalSerializer
    lookup_field = "code"

    def get_queryset(self):
        return self.base_qs().prefetch_related("events", "attachments")


class StatusChange(serializers.Serializer):
    status = serializers.ChoiceField(RequestStatus.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=500, default="")


class PortalRequestStatus(_PortalMixin, APIView):
    @extend_schema(request=StatusChange, responses=RequestPortalSerializer)
    def post(self, request, institution_slug, code):
        req = get_object_or_404(self.base_qs(), code=code)
        s = StatusChange(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            req = set_status(req, s.validated_data["status"], actor=request.user, note=s.validated_data["note"],
                             request=request)  # fmt: skip
        except RequestError as e:
            return Response({"detail": str(e)}, status=409)
        return Response(RequestPortalSerializer(req).data)


class PortalAttachmentDownload(_PortalMixin, APIView):
    @extend_schema(responses={(200, "application/octet-stream"): bytes})
    def get(self, request, institution_slug, code, att_id):
        att = get_object_or_404(Attachment, pk=att_id, request__in=self.base_qs().filter(code=code))
        return FileResponse(att.file.open("rb"), as_attachment=True, filename=att.original_name,
                            content_type=att.content_type)  # fmt: skip
