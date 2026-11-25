"""Catálogo de demonstração com instituições reais de Moçambique (só o nome — sem logótipos nem identidade).

Fontes e o que está por verificar: docs/pesquisa-instituicoes.md.
Respostas das instituições (titulares, faturas, valores em dívida) vêm do conector simulado (connectors/simulated.py).
Valores fixos só com fonte: passaporte (Diploma Ministerial 18/2024) e DIRE CPLP.

Formato do serviço: (slug, nome, nível, pricing, valor_centavos, campos, config_do_conector)
"""

L1, L2, L3 = 1, 2, 3
FIXO, CONSULTA, ABERTO = "fixo", "consulta", "aberto"


def f(name, label, type="text", required=True, pattern=""):
    d = {"name": name, "label": label, "type": type, "required": required}
    if pattern:
        d["pattern"] = pattern
    return d


MATRICULA = f("matricula", "Matrícula do veículo", pattern=r"^[A-Za-z]{3}[- ]?\d{3}[- ]?[A-Za-z]{2}$")
NUIT = f("nuit", "NUIT", pattern=r"^\d{9}$")
NOME = f("nome_completo", "Nome completo (como no BI)")
DATA_NASC = f("data_nascimento", "Data de nascimento", "date")
BI = f("bi", "N.º do Bilhete de Identidade", pattern=r"^[0-9A-Za-z]{8,14}$")


def conf(profile, *guide):
    return {"profile": profile, "guide": list(guide)} if profile else {"guide": list(guide)}


CATEGORIES = [
    ("documentos", "Documentos e migração", "id-card", "Passaporte, DIRE e outros documentos"),
    ("transportes", "Transportes e trânsito", "car", "Multas e impostos sobre veículos"),
    ("servicos-basicos", "Energia, água e telecomunicações", "bolt", "Credelec, faturas, recargas e TV"),
    ("impostos", "Impostos e segurança social", "landmark", "GARE da Autoridade Tributária e contribuições ao INSS"),
    ("educacao", "Educação", "graduation-cap", "Propinas e taxas académicas"),
    ("saude", "Saúde", "heart-pulse", "Facturas hospitalares"),
    ("municipios", "Autarquias", "building", "Impostos e taxas municipais"),
    ("outros", "Seguros e outros", "grid", "Prémios de seguro e outros pagamentos"),
]

# (categoria, slug, nome, [serviços])
INSTITUTIONS = [
    (
        "servicos-basicos",
        "edm",
        "EDM — Electricidade de Moçambique",
        [
            (
                "credelec",
                "Recarga de energia Credelec",
                L1,
                ABERTO,
                None,
                [f("contador", "N.º do contador Credelec", pattern=r"^\d{11,13}$")],
                conf(
                    "credelec",
                    "Recebe o código de recarga logo após o pagamento.",
                    "Introduza-o no teclado do contador.",
                ),
            ),
            (
                "fatura",
                "Fatura de electricidade (pós-pago)",
                L1,
                CONSULTA,
                None,
                [f("cliente", "N.º de cliente", pattern=r"^\d{6,12}$")],
                conf("edm_fatura", "São listadas todas as faturas em aberto."),
            ),
        ],
    ),
    (
        "servicos-basicos",
        "adrmm",
        "Águas da Região Metropolitana de Maputo",
        [
            (
                "fatura",
                "Fatura de água",
                L1,
                CONSULTA,
                None,
                [f("cliente", "N.º de cliente", pattern=r"^\d{5,12}$")],
                conf("agua_fatura", "Maputo, Matola, Boane e Marracuene."),
            ),
        ],
    ),
    (
        "servicos-basicos",
        "vodacom",
        "Vodacom Moçambique",
        [
            (
                "recarga",
                "Recarga de saldo Vodacom",
                L1,
                ABERTO,
                None,
                [f("numero", "Número Vodacom", "phone", pattern=r"^8[45]\d{7}$")],
                conf("recarga"),
            ),
        ],
    ),
    (
        "servicos-basicos",
        "movitel",
        "Movitel",
        [
            (
                "recarga",
                "Recarga de saldo Movitel",
                L1,
                ABERTO,
                None,
                [f("numero", "Número Movitel", "phone", pattern=r"^8[67]\d{7}$")],
                conf("recarga"),
            ),
        ],
    ),
    (
        "servicos-basicos",
        "tmcel",
        "Tmcel",
        [
            (
                "recarga",
                "Recarga de saldo Tmcel",
                L1,
                ABERTO,
                None,
                [f("numero", "Número Tmcel", "phone", pattern=r"^8[23]\d{7}$")],
                conf("recarga"),
            ),
        ],
    ),
    (
        "servicos-basicos",
        "tvcabo",
        "TVCabo Moçambique",
        [
            (
                "mensalidade",
                "Mensalidade de TV e internet",
                L1,
                CONSULTA,
                None,
                [f("cliente", "N.º de cliente", pattern=r"^\d{6,12}$")],
                conf("tv"),
            ),
        ],
    ),
    (
        "servicos-basicos",
        "dstv",
        "DStv Moçambique",
        [
            (
                "mensalidade",
                "Mensalidade DStv",
                L1,
                CONSULTA,
                None,
                [f("smartcard", "N.º do smartcard", pattern=r"^\d{8,12}$")],
                conf("tv"),
            ),
        ],
    ),
    (
        "impostos",
        "at",
        "Autoridade Tributária de Moçambique",
        [
            (
                "gare",
                "Pagamento de impostos (GARE)",
                L2,
                CONSULTA,
                None,
                [NUIT, f("referencia", "Referência da GARE", pattern=r"^\d{8,20}$")],
                conf("at_gare", "Gere a GARE no e-Tributação e indique aqui a referência.", "IVA, IRPS, IRPC e ISPC."),
            ),
        ],
    ),
    (
        "impostos",
        "inss",
        "INSS — Instituto Nacional de Segurança Social",
        [
            (
                "contribuicoes",
                "Contribuições mensais (empresas)",
                L2,
                CONSULTA,
                None,
                [
                    f("nuit", "NUIT do contribuinte", pattern=r"^\d{9}$"),
                    f("guia", "N.º da guia de pagamento", pattern=r"^\d{6,15}$"),
                ],
                conf("inss_guia", "A guia é confirmada no sistema do INSS antes do pagamento."),
            ),
        ],
    ),
    (
        "transportes",
        "inatter",
        "INATTER — Instituto Nacional dos Transportes Terrestres",
        [
            (
                "multas",
                "Multas de trânsito",
                L2,
                CONSULTA,
                None,
                [MATRICULA],
                conf(
                    "inatter_multas",
                    "Mostra todos os autos registados para a matrícula.",
                    "Multas por pagar impedem a renovação da carta.",
                ),
            ),
        ],
    ),
    (
        "municipios",
        "cmm",
        "Conselho Municipal da Cidade de Maputo",
        [
            ("iav", "Imposto Autárquico de Veículos (IAV)", L2, CONSULTA, None, [MATRICULA], conf("iav")),
            (
                "ipra",
                "Imposto Predial Autárquico (IPRA)",
                L2,
                CONSULTA,
                None,
                [f("artigo", "N.º do artigo matricial", pattern=r"^\d{3,10}$")],
                conf("ipra"),
            ),
        ],
    ),
    (
        "documentos",
        "senami",
        "SENAMI — Serviço Nacional de Migração",
        [
            (
                "passaporte-normal",
                "Passaporte — modalidade normal",
                L3,
                FIXO,
                240_000,
                [NOME, DATA_NASC, BI, f("anexo_bi", "Cópia do BI", "file")],
                conf(
                    None,
                    "Taxa do Diploma Ministerial n.º 18/2024.",
                    "Depois de pago, dirija-se ao posto indicado para a recolha biométrica.",
                ),
            ),
            (
                "passaporte-urgente",
                "Passaporte — modalidade urgente",
                L3,
                FIXO,
                277_500,
                [NOME, DATA_NASC, BI, f("anexo_bi", "Cópia do BI", "file")],
                conf(
                    None,
                    "Taxa do Diploma Ministerial n.º 18/2024.",
                    "Depois de pago, dirija-se ao posto indicado para a recolha biométrica.",
                ),
            ),
            (
                "dire-cplp",
                "DIRE — cidadãos da CPLP",
                L3,
                FIXO,
                2_931_000,
                [
                    NOME,
                    f("passaporte", "N.º do passaporte", pattern=r"^[0-9A-Za-z]{6,12}$"),
                    f("anexo_passaporte", "Cópia do passaporte", "file"),
                ],
                conf(None, "Residência temporária, permanente ou vitalícia — Diploma Ministerial n.º 18/2024."),
            ),
        ],
    ),
    (
        "educacao",
        "uem",
        "Universidade Eduardo Mondlane",
        [
            (
                "propinas",
                "Propinas",
                L1,
                CONSULTA,
                None,
                [f("n_estudante", "N.º de estudante", pattern=r"^\d{5,10}$")],
                conf("uem_propinas", "Mostra as prestações em dívida, com multa se estiverem em atraso."),
            ),
        ],
    ),
    (
        "saude",
        "hcm",
        "Hospital Central de Maputo",
        [
            (
                "factura",
                "Factura hospitalar",
                L2,
                CONSULTA,
                None,
                [f("factura", "N.º da factura", pattern=r"^\d{5,12}$")],
                conf("hospital"),
            ),
        ],
    ),
    (
        "outros",
        "emose",
        "EMOSE — Empresa Moçambicana de Seguros",
        [
            (
                "premio",
                "Prémio de seguro",
                L1,
                CONSULTA,
                None,
                [f("apolice", "N.º da apólice", pattern=r"^[0-9A-Za-z/-]{5,20}$")],
                conf("apolice"),
            ),
        ],
    ),
]
