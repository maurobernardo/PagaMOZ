"""Perfis do conector simulado: imitam o que cada tipo de instituição devolve.

Cada perfil é determinístico pelos dados introduzidos (a mesma referência dá sempre a mesma resposta),
para a demonstração ser repetível. Valores e titulares são gerados — não são dados reais de ninguém.
"""

import hashlib
import random
from datetime import date, timedelta

from django.utils import timezone

from .base import Confirmation, LookupError_, QuoteData

FIRST = [
    "Ana",
    "João",
    "Maria",
    "Carlos",
    "Fátima",
    "Alberto",
    "Graça",
    "Hélder",
    "Celeste",
    "Tomás",
    "Lurdes",
    "Paulo",
]
LAST = [
    "Machava",
    "Cossa",
    "Sitoe",
    "Mondlane",
    "Nhantumbo",
    "Langa",
    "Muianga",
    "Chissano",
    "Bila",
    "Tembe",
    "Mabunda",
]
MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
BAIRROS = [
    "Polana Cimento",
    "Sommerschield",
    "Malhangalene",
    "Alto Maé",
    "Xipamanine",
    "Maxaquene",
    "Chamanculo",
    "Hulene",
    "Magoanine",
    "Matola Rio",
    "Machava",
    "Zimpeto",
]
INFRACCOES = [
    ("Excesso de velocidade", "Av. Julius Nyerere"),
    ("Estacionamento proibido", "Av. 24 de Julho"),
    ("Uso de telemóvel durante a condução", "Av. Eduardo Mondlane"),
    ("Falta de cinto de segurança", "Estrada Nacional n.º 4"),
    ("Desrespeito ao sinal vermelho", "Av. Vladimir Lenine"),
    ("Falta de seguro obrigatório", "Av. Marginal"),
]
CURSOS = [
    ("Engenharia Informática", "Faculdade de Engenharia"),
    ("Direito", "Faculdade de Direito"),
    ("Economia", "Faculdade de Economia"),
    ("Medicina", "Faculdade de Medicina"),
    ("Arquitectura", "Faculdade de Arquitectura e Planeamento Físico"),
]


def rng_for(service, payload: dict) -> random.Random:
    key = f"{service.pk}|" + "|".join(f"{k}={payload[k]}" for k in sorted(payload))
    return random.Random(int(hashlib.sha256(key.encode()).hexdigest(), 16))


def person(r: random.Random) -> str:
    return f"{r.choice(FIRST)} {r.choice(LAST)}"


def mask(name: str) -> str:
    return " ".join(p[0] + "*" * (len(p) - 1) for p in name.split())


def mt(centavos: int) -> str:
    return f"{centavos / 100:,.2f}".replace(",", " ").replace(".", ",") + " MT"


def money(r: random.Random, lo_mt: int, hi_mt: int, step_mt: int = 5) -> int:
    return r.randrange(lo_mt, hi_mt, step_mt) * 100


def last_months(n: int, end: date | None = None) -> list[date]:
    d = (end or timezone.localdate()).replace(day=1)
    out = []
    for _ in range(n):
        d = (d - timedelta(days=1)).replace(day=1)
        out.append(d)
    return list(reversed(out))


def first_value(payload: dict) -> str:
    return str(next(iter(payload.values()), ""))


# ---------- Perfis: consulta ----------


def credelec(service, payload, amount):
    r = rng_for(service, payload)
    meter = payload.get("contador", "")
    return QuoteData(
        amount=amount,
        description=f"Recarga Credelec — contador {meter}",
        holder=mask(person(r)),
        details=[
            ["Contador", meter],
            ["Tipo", "Credelec (pré-pago)"],
            ["Zona", r.choice(BAIRROS)],
            ["Última recarga", (timezone.localdate() - timedelta(days=r.randint(3, 40))).strftime("%d/%m/%Y")],
        ],
        external_ref=f"EDM{r.randint(10**7, 10**8 - 1)}",
    )


def faturas(prefix: str, lo: int, hi: int, label: str):
    def lookup(service, payload, amount):
        r = rng_for(service, payload)
        n = r.choice([1, 1, 2, 3])
        items = []
        for m in last_months(n):
            v = money(r, lo, hi)
            due = m.replace(day=28) + timedelta(days=10)
            items.append(
                {
                    "titulo": f"Fatura {MESES[m.month - 1]}/{m.year}",
                    "referencia": f"{prefix}{m:%y%m}{r.randint(1000, 9999)}",
                    "detalhe": f"Vencimento {due:%d/%m/%Y}" + (" · em atraso" if due < timezone.localdate() else ""),
                    "valor": v,
                }
            )
        total = sum(i["valor"] for i in items)
        ref = first_value(payload)
        return QuoteData(
            amount=total,
            description=f"{label} — cliente {ref}",
            holder=mask(person(r)),
            details=[["N.º de cliente", ref], ["Local de consumo", r.choice(BAIRROS)], ["Faturas em aberto", str(n)]],
            items=items,
            external_ref=f"{prefix}{r.randint(10**6, 10**7 - 1)}",
        )

    return lookup


def at_gare(service, payload, amount):
    r = rng_for(service, payload)
    imposto = r.choice(["IVA", "IRPS", "IRPC", "ISPC"])
    periodo = last_months(1)[0]
    prazo = timezone.localdate().replace(day=1) + timedelta(days=r.randint(5, 25))
    valor = money(r, 1500, 85000, 5)
    return QuoteData(
        amount=valor,
        description=f"{imposto} — período {MESES[periodo.month - 1]}/{periodo.year}",
        holder=mask(person(r)),
        details=[
            ["NUIT", payload.get("nuit", "")],
            ["Referência GARE", payload.get("referencia", "")],
            ["Imposto", imposto],
            ["Período de tributação", f"{MESES[periodo.month - 1]}/{periodo.year}"],
            ["Data-limite", prazo.strftime("%d/%m/%Y")],
        ],
        external_ref=f"GARE{r.randint(10**8, 10**9 - 1)}",
    )


def inatter_multas(service, payload, amount):
    r = rng_for(service, payload)
    n = r.choice([1, 1, 2, 3])
    items = []
    for _ in range(n):
        infr, local = r.choice(INFRACCOES)
        d = timezone.localdate() - timedelta(days=r.randint(10, 300))
        items.append(
            {
                "titulo": infr,
                "referencia": f"AUTO-{d:%Y}-{r.randint(100000, 999999)}",
                "detalhe": f"{d:%d/%m/%Y} · {local}",
                "valor": money(r, 1000, 10000, 100),
            }
        )
    return QuoteData(
        amount=sum(i["valor"] for i in items),
        description=f"Multas de trânsito — {payload.get('matricula', '')}",
        holder=mask(person(r)),
        items=items,
        details=[
            ["Matrícula", payload.get("matricula", "")],
            ["Autos em dívida", str(n)],
            ["Aviso", "Multas por pagar impedem a renovação da carta de condução."],
        ],
        external_ref=f"INT{r.randint(10**7, 10**8 - 1)}",
    )


def inss_guia(service, payload, amount):
    r = rng_for(service, payload)
    periodo = last_months(1)[0]
    trab = r.randint(3, 180)
    return QuoteData(
        amount=money(r, 2000, 450000, 5),
        description=f"Contribuições {MESES[periodo.month - 1]}/{periodo.year}",
        holder=f"{r.choice(LAST)} & {r.choice(LAST)}, Lda.",
        details=[
            ["NUIT do contribuinte", payload.get("nuit", "")],
            ["Guia n.º", payload.get("guia", "")],
            ["Período", f"{MESES[periodo.month - 1]}/{periodo.year}"],
            ["Trabalhadores declarados", str(trab)],
        ],
        external_ref=f"SISSMO{r.randint(10**7, 10**8 - 1)}",
    )


def iav(service, payload, amount):
    r = rng_for(service, payload)
    ano = timezone.localdate().year
    return QuoteData(
        amount=money(r, 800, 6500, 50),
        description=f"IAV {ano} — {payload.get('matricula', '')}",
        holder=mask(person(r)),
        details=[
            ["Matrícula", payload.get("matricula", "")],
            ["Ano fiscal", str(ano)],
            ["Categoria", r.choice(["Ligeiro de passageiros", "Ligeiro de mercadorias", "Motociclo"])],
        ],
        external_ref=f"CMM{r.randint(10**7, 10**8 - 1)}",
    )


def ipra(service, payload, amount):
    r = rng_for(service, payload)
    ano = timezone.localdate().year
    return QuoteData(
        amount=money(r, 1200, 30000, 10),
        description=f"IPRA {ano} — artigo {payload.get('artigo', '')}",
        holder=mask(person(r)),
        details=[["Artigo matricial", payload.get("artigo", "")], ["Bairro", r.choice(BAIRROS)], ["Ano", str(ano)]],
        external_ref=f"CMM{r.randint(10**7, 10**8 - 1)}",
    )


def uem_propinas(service, payload, amount):
    r = rng_for(service, payload)
    curso, fac = r.choice(CURSOS)
    n = r.choice([1, 1, 2])
    items = []
    for m in last_months(n):
        v = money(r, 800, 3500, 50)
        atraso = m < last_months(1)[0]
        items.append(
            {
                "titulo": f"Propina {MESES[m.month - 1]}/{m.year}",
                "referencia": f"UEM{m:%y%m}{r.randint(100, 999)}",
                "detalhe": "Inclui multa por atraso" if atraso else "Dentro do prazo",
                "valor": v + (v // 10 if atraso else 0),
            }
        )
    return QuoteData(
        amount=sum(i["valor"] for i in items),
        description=f"Propinas — estudante {payload.get('n_estudante', '')}",
        holder=mask(person(r)),
        items=items,
        details=[
            ["N.º de estudante", payload.get("n_estudante", "")],
            ["Curso", curso],
            ["Faculdade", fac],
            ["Prestações em dívida", str(n)],
        ],
        external_ref=f"UEM{r.randint(10**6, 10**7 - 1)}",
    )


def recarga(service, payload, amount):
    r = rng_for(service, payload)
    numero = payload.get("numero", "")
    return QuoteData(
        amount=amount,
        description=f"Recarga {service.name.split()[-1]} — {numero}",
        details=[["Número", numero], ["Saldo actual", "não divulgado pela operadora"]],
        external_ref=f"RC{r.randint(10**7, 10**8 - 1)}",
    )


def tv(service, payload, amount):
    r = rng_for(service, payload)
    pacote = r.choice(["Básico", "Família", "Premium"])
    v = {"Básico": money(r, 500, 900, 50), "Família": money(r, 1200, 2000, 50), "Premium": money(r, 2500, 4500, 50)}[
        pacote
    ]
    venc = timezone.localdate().replace(day=1) + timedelta(days=r.randint(3, 27))
    return QuoteData(
        amount=v,
        description=f"{service.name} — pacote {pacote}",
        holder=mask(person(r)),
        details=[["Cliente", first_value(payload)], ["Pacote", pacote], ["Renova até", venc.strftime("%d/%m/%Y")]],
        external_ref=f"TV{r.randint(10**7, 10**8 - 1)}",
    )


def apolice(service, payload, amount):
    r = rng_for(service, payload)
    return QuoteData(
        amount=money(r, 900, 15000, 10),
        description=f"Prémio de seguro — apólice {payload.get('apolice', '')}",
        holder=mask(person(r)),
        details=[
            ["Apólice", payload.get("apolice", "")],
            ["Ramo", r.choice(["Automóvel", "Saúde", "Habitação"])],
            ["Fracção", r.choice(["Mensal", "Trimestral"])],
        ],
        external_ref=f"AP{r.randint(10**7, 10**8 - 1)}",
    )


def hospital(service, payload, amount):
    r = rng_for(service, payload)
    return QuoteData(
        amount=money(r, 300, 12000, 10),
        description=f"Factura hospitalar {payload.get('factura', '')}",
        holder=mask(person(r)),
        details=[
            ["Factura n.º", payload.get("factura", "")],
            ["Serviço", r.choice(["Consulta externa", "Análises clínicas", "Imagiologia", "Internamento"])],
        ],
        external_ref=f"HCM{r.randint(10**6, 10**7 - 1)}",
    )


LOOKUPS = {
    "credelec": credelec,
    "edm_fatura": faturas("EDM", 400, 9500, "Fatura de electricidade"),
    "agua_fatura": faturas("AD", 250, 4200, "Fatura de água"),
    "at_gare": at_gare,
    "inatter_multas": inatter_multas,
    "inss_guia": inss_guia,
    "iav": iav,
    "ipra": ipra,
    "uem_propinas": uem_propinas,
    "recarga": recarga,
    "tv": tv,
    "apolice": apolice,
    "hospital": hospital,
}


# ---------- Perfis: o que a instituição entrega depois de pago ----------


def deliver(profile: str, txn) -> Confirmation:
    r = random.Random(int(hashlib.sha256(txn.reference.encode()).hexdigest(), 16))
    ack = f"{txn.institution.slug.upper()[:6]}-{r.randint(10**7, 10**8 - 1)}"
    if profile == "credelec":
        token = "".join(str(r.randint(0, 9)) for _ in range(20))
        return Confirmation(
            ack,
            delivery={
                "titulo": "Código de recarga Credelec",
                "codigo": " ".join(token[i : i + 4] for i in range(0, 20, 4)),
                "instrucao": "Introduza o código no teclado do contador e confirme. "
                "Guarde-o até a energia ser creditada.",
            },
        )
    if profile == "recarga":
        return Confirmation(
            ack,
            delivery={
                "titulo": "Recarga efectuada",
                "codigo": ack,
                "instrucao": "O saldo é creditado no número indicado em poucos segundos.",
            },
        )
    if profile == "at_gare":
        return Confirmation(
            ack,
            delivery={
                "titulo": "GARE liquidada",
                "codigo": ack,
                "instrucao": "A Autoridade Tributária regista o pagamento na conta corrente do NUIT.",
            },
        )
    if profile == "inatter_multas":
        return Confirmation(
            ack,
            delivery={
                "titulo": "Multas liquidadas",
                "codigo": ack,
                "instrucao": "Os autos ficam pagos e deixam de impedir a renovação da carta.",
            },
        )
    return Confirmation(ack, delivery={"titulo": "Pagamento registado na instituição", "codigo": ack, "instrucao": ""})


def lookup(service, payload: dict, amount: int | None) -> QuoteData:
    profile = (service.connector_config or {}).get("profile")
    fn = LOOKUPS.get(profile)
    if fn is None:
        raise LookupError_("Serviço sem consulta disponível.")
    q = fn(service, payload, amount)
    if q.amount is None or q.amount <= 0:
        raise LookupError_("Indique o valor a pagar.")
    return q


__all__ = ["LOOKUPS", "deliver", "lookup", "mt"]
