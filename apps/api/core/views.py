from django.conf import settings
from django.db import connection
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .tasks import ping


def _check(fn) -> str:
    try:
        fn()
        return "ok"
    except Exception:  # health check: reporta, não rebenta
        return "erro"


@extend_schema(
    responses=inline_serializer(
        "Health",
        {
            "status": serializers.CharField(),
            "database": serializers.CharField(),
            "queue": serializers.CharField(),
            "demo_mode": serializers.BooleanField(),
        },
    )
)
@api_view(["GET"])
def health(request):
    db = _check(lambda: connection.cursor().execute("SELECT 1"))
    queue = _check(lambda: ping.apply_async().get(timeout=5))
    ok = db == queue == "ok"
    return Response(
        {"status": "ok" if ok else "degradado", "database": db, "queue": queue, "demo_mode": settings.DEMO_MODE},
        status=200 if ok else 503,
    )
