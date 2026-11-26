"""Pesquisa tolerante do catálogo: siglas, nomes antigos, sinónimos do dia a dia, sem acentos e com erros de escrita.

As pessoas conhecem as instituições pela sigla ou pelo nome antigo ("INATRO", "EDM", "mCel")
e escrevem como falam ("luz", "crédito", "multa do carro"). Isto junta tudo num índice simples.

ponytail: índice em memória por pedido (catálogo de dezenas de serviços). Trocar por pesquisa
full-text do Postgres quando passar de alguns milhares.
"""

import re
import unicodedata
from difflib import SequenceMatcher

# Por instituição: siglas, nomes antigos e palavras que as pessoas usam.
ALIASES: dict[str, list[str]] = {
    "edm": [
        "edm",
        "luz",
        "energia",
        "electricidade",
        "eletricidade",
        "corrente",
        "contador",
        "credelec",
        "pre pago",
        "pos pago",
    ],
    "adrmm": ["agua", "aguas", "fipag", "aguas de mocambique", "adrmm", "torneira"],
    "vodacom": ["vodacom", "voda", "m pesa", "mpesa", "credito", "saldo", "recarga", "megas", "dados"],
    "movitel": ["movitel", "e mola", "emola", "credito", "saldo", "recarga", "megas", "dados"],
    "tmcel": ["tmcel", "mcel", "mkesh", "m kesh", "credito", "saldo", "recarga", "megas", "dados"],
    "tvcabo": ["tvcabo", "tv cabo", "televisao", "tv", "internet", "canais"],
    "dstv": ["dstv", "multichoice", "televisao", "tv", "canais", "futebol"],
    "zap": ["zap", "televisao", "tv", "canais"],
    "at": ["at", "autoridade tributaria", "financas", "impostos", "imposto", "gare", "iva", "irps", "irpc", "nuit"],
    "inss": ["inss", "seguranca social", "contribuicoes", "reforma", "pensao"],
    "inatter": [
        "inatter",
        "inatro",
        "transito",
        "transportes",
        "multa",
        "multas",
        "carro",
        "viatura",
        "carta",
        "conducao",
        "policia",
    ],
    "cmm": ["cmm", "conselho municipal", "municipio", "camara", "autarquia", "iav", "ipra", "predial"],
    "senami": ["senami", "migracao", "emigracao", "passaporte", "dire", "residencia", "estrangeiro", "visto"],
    "uem": ["uem", "universidade", "eduardo mondlane", "propina", "propinas", "matricula", "faculdade"],
    "hcm": ["hcm", "hospital", "central", "consulta", "saude", "factura hospitalar"],
    "emose": ["emose", "seguro", "seguros", "apolice"],
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def _acronym(name: str) -> str:
    m = re.search(r"\(([^)]+)\)", name or "")
    return m.group(1) if m else ""


def haystack(service) -> list[str]:
    inst = service.institution
    cfg = service.connector_config or {}
    parts = [
        service.name,
        service.description,
        inst.name,
        inst.slug,
        _acronym(inst.name),
        service.category.name if service.category_id else "",
        cfg.get("option", ""),
        cfg.get("group", ""),
        *ALIASES.get(inst.slug, []),
        *cfg.get("keywords", []),
    ]
    return [norm(p) for p in parts if p]


def score(query: str, hay: list[str]) -> float:
    """0 = não corresponde. Cada palavra da pesquisa tem de bater em alguma coisa."""
    q = norm(query)
    if not q:
        return 0.0
    phrases = hay
    tokens = {t for h in hay for t in h.split()}
    total = 0.0
    if any(q == h for h in phrases):
        total += 5
    elif any(q in h for h in phrases):
        total += 3
    for word in q.split():
        if word in tokens:
            best = 3.0
        elif len(word) >= 3 and any(t.startswith(word) for t in tokens):
            best = 2.0
        elif len(word) >= 3 and any(word in h for h in phrases):
            best = 1.5
        else:
            # erros de escrita: "inatro" ~ "inatter", "electrisidade" ~ "electricidade"
            r = max((SequenceMatcher(None, word, t).ratio() for t in tokens if abs(len(t) - len(word)) <= 3), default=0)
            best = r if r >= 0.75 and len(word) >= 4 else 0.0
        if best == 0.0:
            return 0.0
        total += best
    return total


def rank(services, query: str):
    words = set(norm(query).split())

    def own(s) -> float:  # a palavra está no nome do próprio serviço: "credelec" -> Recarga Credelec, não a fatura
        return 2.0 * len(words & set(norm(f"{s.name} {s.slug}").split()))

    scored = [((sc + own(s)) if (sc := score(query, haystack(s))) else 0, s) for s in services]
    return [s for sc, s in sorted(scored, key=lambda x: -x[0]) if sc > 0]


if __name__ == "__main__":
    hay = [
        norm(x)
        for x in ["Multas de trânsito", "Instituto Nacional dos Transportes Terrestres (INATTER)", *ALIASES["inatter"]]
    ]
    assert score("INATRO", hay) > 0 and score("inater", hay) > 0 and score("multa carro", hay) > 0
    assert score("passaporte", hay) == 0
    print("ok")
