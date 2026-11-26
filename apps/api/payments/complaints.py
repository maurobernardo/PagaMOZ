"""Reclamações: o cidadão reclama de um pagamento (a referência é a chave de acesso); a instituição responde."""

from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from audit.models import record
from institutions.models import Membership
from portal.api import PortalView

from .models import Complaint, Status, Transaction

OPEN = (Complaint.State.OPEN, Complaint.State.REVIEW)


class ComplaintSerializer(serializers.ModelSerializer):
    reason_label = serializers.CharField(source="get_reason_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    reference = serializers.CharField(source="transaction.reference", read_only=True)
    service_name = serializers.CharField(source="transaction.service.name", read_only=True)
    amount = serializers.IntegerField(source="transaction.total", read_only=True)

    class Meta:
        model = Complaint
        fields = [
            "id",
            "reference",
            "service_name",
            "amount",
            "reason",
            "reason_label",
            "message",
            "contact",
            "status",
            "status_label",
            "response",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["status", "response"]


class ComplaintThrottle(AnonRateThrottle):
    rate = "10/hour"


class PaymentComplaints(APIView):
    """GET: reclamações deste pagamento. POST: abrir uma (uma aberta de cada vez)."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ComplaintThrottle]

    def _txn(self, reference):
        return get_object_or_404(Transaction.objects.select_related("service", "institution"), reference=reference)

    @extend_schema(responses=ComplaintSerializer(many=True))
    def get(self, request, reference):
        return Response(ComplaintSerializer(self._txn(reference).complaints.all(), many=True).data)

    @extend_schema(request=ComplaintSerializer, responses={201: ComplaintSerializer})
    def post(self, request, reference):
        txn = self._txn(reference)
        if txn.status in (Status.CREATED,):
            return Response({"detail": "Este pagamento ainda não foi enviado."}, status=400)
        if txn.complaints.filter(status__in=OPEN).exists():
            return Response({"detail": "Já existe uma reclamação aberta para este pagamento."}, status=400)
        s = ComplaintSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        c = s.save(transaction=txn)
        record("complaint.open", request=request, institution=txn.institution, target=txn, reason=c.reason)
        return Response(ComplaintSerializer(c).data, status=201)


class RespondSerializer(serializers.Serializer):
    status = serializers.ChoiceField([Complaint.State.REVIEW, Complaint.State.RESOLVED, Complaint.State.REJECTED])
    response = serializers.CharField(min_length=5, max_length=1000)


class PortalComplaints(PortalView):
    """Reclamações dos pagamentos desta instituição (as abertas primeiro)."""

    @extend_schema(responses=ComplaintSerializer(many=True))
    def get(self, request, institution_slug):
        inst = self.institution()
        qs = Complaint.objects.filter(transaction__institution=inst).select_related("transaction__service")
        if request.query_params.get("abertas"):
            qs = qs.filter(Q(status__in=OPEN))
        rows = sorted(qs[:200], key=lambda c: (c.status not in OPEN, -c.created_at.timestamp()))
        return Response(ComplaintSerializer(rows, many=True).data)


class PortalRespondComplaint(PortalView):
    """Responder: muda o estado e avisa o cidadão (push, se tiver a app com sessão)."""

    write_roles = {Membership.Role.ADMIN, Membership.Role.FINANCE, Membership.Role.OPERATOR}

    @extend_schema(request=RespondSerializer, responses=ComplaintSerializer)
    def post(self, request, institution_slug, pk):
        inst = self.institution()
        c = get_object_or_404(Complaint.objects.select_related("transaction"), pk=pk, transaction__institution=inst)
        s = RespondSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        c.status, c.response = s.validated_data["status"], s.validated_data["response"]
        c.save(update_fields=["status", "response", "updated_at"])
        record("complaint.respond", request=request, institution=inst, target=c.transaction, status=c.status)
        if c.transaction.user_id:
            from accounts.models import PushDevice
            from accounts.tasks import send

            msgs = [
                {
                    "to": d.token,
                    "title": f"Reclamação {c.get_status_display().lower()}",
                    "body": c.response[:150],
                    "data": {"url": f"pagamoz://pagamento/{c.transaction.reference}"},
                }
                for d in PushDevice.objects.filter(user_id=c.transaction.user_id)
            ]
            try:
                send(msgs)
            except OSError:
                pass  # o aviso é acessório; a resposta fica visível no pagamento
        return Response(ComplaintSerializer(c).data)
