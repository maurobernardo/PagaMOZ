"""Teste de carga básico (só stdlib): o percurso do cidadão — catálogo, consulta, pagamento, estado.

Uso:
  # API com LOAD_TEST=true DEBUG=true (limites de pedidos desligados) e dados demo
  python infra/load/carga.py --url http://localhost:8000 --utilizadores 20 --segundos 60

Mede latência p50/p95/p99 por passo, débito e erros. Não é um benchmark de produção:
o servidor de desenvolvimento e o SQLite são o tecto aqui; repetir em staging com gunicorn + Postgres.
"""

import argparse
import json
import random
import statistics
import threading
import time
import urllib.error
import urllib.request
import uuid
from collections import defaultdict

lat: dict[str, list[float]] = defaultdict(list)
errors: dict[str, int] = defaultdict(int)
lock = threading.Lock()


def call(base, step, method, path, body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method,
                                 headers={"Content-Type": "application/json", **(headers or {})})  # fmt: skip
    t = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            out = json.loads(r.read() or b"null")
        ok = True
    except (urllib.error.URLError, TimeoutError, ValueError):
        out, ok = None, False
    ms = (time.perf_counter() - t) * 1000
    with lock:
        lat[step].append(ms)
        if not ok:
            errors[step] += 1
    return out


def journey(base, services):
    call(base, "catalogo", "GET", "/api/catalog/categories")
    s = random.choice(services)
    fields = {f["name"]: "123456789" if "{9}" in f.get("pattern", "") else "12345678"
              for f in s["fields"] if f["type"] != "file"}  # fmt: skip
    body = {"service": s["id"], "method": "mpesa", "scenario": "sucesso", "fields": fields}
    q = call(base, "consulta", "POST", f"/api/catalog/services/{s['id']}/quote", {"fields": fields})
    if not q:
        return
    body["quote"] = q["id"]
    p = call(base, "pagamento", "POST", "/api/payments", body, {"Idempotency-Key": f"load-{uuid.uuid4()}"})
    if p:
        call(base, "estado", "GET", f"/api/payments/{p['reference']}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8000")
    ap.add_argument("--utilizadores", type=int, default=10)
    ap.add_argument("--segundos", type=int, default=30)
    a = ap.parse_args()

    listing = json.loads(urllib.request.urlopen(f"{a.url}/api/catalog/services?page_size=200").read())
    # Só serviços de consulta com campos de 8 dígitos válidos (contrato/estudante): percurso nível 1.
    services = [s for s in listing["results"] if s["pricing"] == "consulta"
                and all(f["type"] == "file" or f.get("pattern", "").startswith("^\\d") for f in s["fields"])]  # fmt: skip
    if not services:
        raise SystemExit("Sem serviços de consulta. Corra seed_demo.")

    stop = time.time() + a.segundos
    journeys = [0]

    def worker():
        while time.time() < stop:
            journey(a.url, services)
            with lock:
                journeys[0] += 1

    threads = [threading.Thread(target=worker) for _ in range(a.utilizadores)]
    t0 = time.time()
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    took = time.time() - t0

    total = sum(len(v) for v in lat.values())
    print(f"\n{a.utilizadores} utilizadores · {took:.0f}s · {journeys[0]} percursos · {total / took:.1f} pedidos/s\n")
    print(f"{'passo':<10} {'n':>6} {'erros':>6} {'p50 ms':>8} {'p95 ms':>8} {'p99 ms':>8}")
    for step, v in lat.items():
        qs = statistics.quantiles(v, n=100) if len(v) > 1 else [v[0]] * 99
        print(f"{step:<10} {len(v):>6} {errors[step]:>6} {qs[49]:>8.0f} {qs[94]:>8.0f} {qs[98]:>8.0f}")


if __name__ == "__main__":
    main()
