"""Observabilidade sem dependências: request-id, access log estruturado (JSON), métricas Prometheus."""

import contextvars
import json
import logging
import re
import threading
import time
import uuid
from collections import Counter

from django.conf import settings
from django.http import HttpResponse

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")
log = logging.getLogger("pagamoz.access")
_SAFE_ID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")

# ---------- Métricas em memória (por processo) ----------
_lock = threading.Lock()
_requests: Counter = Counter()  # (método, rota, classe de estado)
_duration_sum: Counter = Counter()
_duration_count: Counter = Counter()


def _route(request) -> str:
    # Rota (ex. api/payments/<str:reference>) e não o caminho: evita cardinalidade infinita.
    m = getattr(request, "resolver_match", None)
    return m.route if m else "unmatched"


class RequestIdFilter(logging.Filter):
    def filter(self, record):
        record.request_id = request_id_var.get()
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record):
        out = {"ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"), "level": record.levelname,
               "logger": record.name, "msg": record.getMessage(),
               "request_id": getattr(record, "request_id", "-")}  # fmt: skip
        out.update(getattr(record, "fields", {}))
        if record.exc_info:
            out["exc"] = self.formatException(record.exc_info)
        return json.dumps(out, ensure_ascii=False, default=str)


class RequestIdMiddleware:
    """Aceita X-Request-ID do proxy (se válido) ou gera um; devolve-o e regista uma linha por pedido."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        incoming = request.headers.get("X-Request-ID", "")
        rid = incoming if _SAFE_ID.match(incoming) else uuid.uuid4().hex
        token = request_id_var.set(rid)
        start = time.perf_counter()
        try:
            response = self.get_response(request)
            self._record(request, response, rid, start)
        finally:
            request_id_var.reset(token)
        return response

    def _record(self, request, response, rid, start):
        ms = (time.perf_counter() - start) * 1000
        response["X-Request-ID"] = rid
        route = _route(request)
        with _lock:
            key = (request.method, route, f"{response.status_code // 100}xx")
            _requests[key] += 1
            _duration_sum[(request.method, route)] += ms / 1000
            _duration_count[(request.method, route)] += 1
        user = getattr(request, "user", None)
        uid = user.pk if user is not None and user.is_authenticated else None
        fields = {"method": request.method, "path": request.path, "route": route, "status": response.status_code,
                  "duration_ms": round(ms, 1), "user": uid}  # fmt: skip
        log.info("%s %s %s", request.method, request.path, response.status_code, extra={"fields": fields})


def _esc(v) -> str:
    return str(v).replace("\\", "\\\\").replace('"', '\\"')


def metrics(request):
    """Formato Prometheus. Protegido por token (METRICS_TOKEN): não expor publicamente."""
    token = settings.METRICS_TOKEN
    if not token or request.headers.get("Authorization") != f"Bearer {token}":
        return HttpResponse(status=404)
    from django.db.models import Count
    from django.utils import timezone

    from payments.models import DeadLetter, Transaction
    from reconciliation.models import Discrepancy

    lines = ["# TYPE pagamoz_http_requests_total counter"]
    with _lock:
        for (m, r, s), n in sorted(_requests.items()):
            lines.append(f'pagamoz_http_requests_total{{method="{m}",route="{_esc(r)}",status="{s}"}} {n}')
        lines.append("# TYPE pagamoz_http_request_duration_seconds summary")
        for (m, r), total in sorted(_duration_sum.items()):
            lbl = f'method="{m}",route="{_esc(r)}"'
            lines.append(f"pagamoz_http_request_duration_seconds_sum{{{lbl}}} {total:.6f}")
            lines.append(f"pagamoz_http_request_duration_seconds_count{{{lbl}}} {_duration_count[(m, r)]}")

    since = timezone.now() - timezone.timedelta(hours=24)
    lines.append("# TYPE pagamoz_payments_24h gauge")
    for row in Transaction.objects.filter(created_at__gte=since).values("status", "method").annotate(n=Count("id")):
        lines.append(f'pagamoz_payments_24h{{status="{row["status"]}",method="{row["method"]}"}} {row["n"]}')
    lines += [
        "# TYPE pagamoz_dead_letters gauge",
        f"pagamoz_dead_letters {DeadLetter.objects.filter(resolved=False).count()}",
        "# TYPE pagamoz_open_discrepancies gauge",
        f"pagamoz_open_discrepancies {Discrepancy.objects.filter(resolved=False).count()}",
    ]
    return HttpResponse("\n".join(lines) + "\n", content_type="text/plain; version=0.0.4")
