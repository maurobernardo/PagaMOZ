"""Catálogo de demonstração com instituições reais de Moçambique (só o nome: sem logótipos nem identidade).

Fontes e o que está por verificar: docs/pesquisa-instituicoes.md.
Respostas das instituições (titulares, faturas, valores em dívida) vêm do conector simulado (connectors/simulated.py).
Valores fixos só com fonte: passaporte (Diploma Ministerial 18/2024) e DIRE CPLP.

Formato do serviço: (slug, nome, nível, pricing, valor_centavos, campos, config_do_conector)
"""

L1, L2, L3 = 1, 2, 3
FIXO, CONSULTA, ABERTO = "fixo", "consulta", "aberto"


def f(name, label, type="text", required=True, pattern="", help=""):
    d = {"name": name, "label": label, "type": type, "required": required}
    if pattern:
        d["pattern"] = pattern
    if help:
        d["help"] = help  # "onde encontro isto?", em linguagem simples
    return d


MATRICULA = f(
    "matricula",
    "Matrícula do veículo",
    pattern=r"^[A-Za-z]{3}[- ]?\d{3}[- ]?[A-Za-z]{2}$",
    help="Está na chapa do carro e no livrete. Ex.: AFG-123-MC.",
)
NUIT = f("nuit", "NUIT", pattern=r"^\d{9}$", help="Número de 9 algarismos do cartão NUIT.")
NOME = f("nome_completo", "Nome completo (como no BI)")
DATA_NASC = f("data_nascimento", "Data de nascimento", "date")
BI = f(
    "bi",
    "N.º do Bilhete de Identidade",
    pattern=r"^[0-9A-Za-z]{8,14}$",
    help="Está na frente do BI, por baixo da fotografia.",
)


def conf(profile, *guide):
    return {"profile": profile, "guide": list(guide)} if profile else {"guide": list(guide)}


# Serviços do mesmo assunto aparecem num só cartão; o cidadão escolhe a opção (operadora, canal...).
GROUPS = {
    "recarga": ("Recarga de saldo", "Escolha a sua operadora"),
    "tv": ("TV por assinatura", "Escolha o seu fornecedor"),
    "energia": ("Electricidade (EDM)", "Escolha o tipo de contador"),
}


def grouped(cfg, group, option):
    return {**cfg, "group": group, "option": option}


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
        "Electricidade de Moçambique (EDM)",
        [
            (
                "credelec",
                "Recarga de energia Credelec",
                L1,
                ABERTO,
                None,
                [
                    f(
                        "contador",
                        "N.º do contador Credelec",
                        pattern=r"^\d{11,13}$",
                        help="Está escrito no contador e nos talões de recargas anteriores.",
                    )
                ],
                grouped(
                    conf(
                        "credelec",
                        "Recebe o código de recarga logo após o pagamento.",
                        "Introduza-o no teclado do contador.",
                    ),
                    "energia",
                    "Credelec (pré-pago)",
                ),
            ),
            (
                "fatura",
                "Fatura de electricidade (pós-pago)",
                L1,
                CONSULTA,
                None,
                [f("cliente", "N.º de cliente", pattern=r"^\d{6,12}$", help="Está no topo da última fatura.")],
                grouped(conf("edm_fatura", "São listadas todas as faturas em aberto."), "energia", "Fatura (pós-pago)"),
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
                [f("cliente", "N.º de cliente", pattern=r"^\d{5,12}$", help="Está no topo da última fatura da água.")],
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
                grouped(conf("recarga"), "recarga", "Vodacom"),
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
                grouped(conf("recarga"), "recarga", "Movitel"),
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
                grouped(conf("recarga"), "recarga", "Tmcel"),
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
                [f("cliente", "N.º de cliente", pattern=r"^\d{6,12}$", help="Está no topo da última fatura.")],
                grouped(conf("tv"), "tv", "TVCabo"),
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
                [
                    f(
                        "smartcard",
                        "N.º do smartcard",
                        pattern=r"^\d{8,12}$",
                        help="Está no cartão dentro do descodificador.",
                    )
                ],
                grouped(conf("tv"), "tv", "DStv"),
            ),
        ],
    ),
    (
        "servicos-basicos",
        "zap",
        "ZAP Moçambique",
        [
            (
                "mensalidade",
                "Mensalidade ZAP",
                L1,
                CONSULTA,
                None,
                [
                    f(
                        "smartcard",
                        "N.º do cartão ZAP",
                        pattern=r"^\d{8,12}$",
                        help="Está no cartão dentro do descodificador.",
                    )
                ],
                grouped(conf("tv"), "tv", "ZAP"),
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
                [
                    NUIT,
                    f("referencia", "Referência da GARE", pattern=r"^\d{8,20}$", help="Está impressa na guia GARE."),
                ],
                conf("at_gare", "Gere a GARE no e-Tributação e indique aqui a referência.", "IVA, IRPS, IRPC e ISPC."),
            ),
        ],
    ),
    (
        "impostos",
        "inss",
        "Instituto Nacional de Segurança Social (INSS)",
        [
            (
                "contribuicoes",
                "Contribuições mensais (empresas)",
                L2,
                CONSULTA,
                None,
                [
                    f("nuit", "NUIT do contribuinte", pattern=r"^\d{9}$"),
                    f("guia", "N.º da guia de pagamento", pattern=r"^\d{6,15}$", help="Está no topo da guia do INSS."),
                ],
                conf("inss_guia", "A guia é confirmada no sistema do INSS antes do pagamento."),
            ),
        ],
    ),
    (
        "transportes",
        "inatter",
        "Instituto Nacional dos Transportes Terrestres (INATTER)",
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
        "Serviço Nacional de Migração (SENAMI)",
        [
            (
                "passaporte",
                "Passaporte",
                L3,
                FIXO,
                240_000,  # modalidade mais barata, para mostrar "desde"
                [
                    f("modalidade", "Modalidade", "select"),
                    NOME,
                    DATA_NASC,
                    BI,
                    f("anexo_bi", "Cópia do BI", "file"),
                ],
                {
                    **conf(
                        None,
                        "Taxas do Diploma Ministerial n.º 18/2024.",
                        "Depois de pago, dirija-se ao posto indicado para a recolha biométrica.",
                    ),
                    "variants": [
                        {"key": "normal", "label": "Normal", "amount": 240_000, "hint": "Prazo regular de emissão"},
                        {"key": "urgente", "label": "Urgente", "amount": 277_500, "hint": "Emissão prioritária"},
                    ],
                },
            ),
            (
                "dire-cplp",
                "DIRE para cidadãos da CPLP",
                L3,
                FIXO,
                2_931_000,
                [
                    NOME,
                    f("passaporte", "N.º do passaporte", pattern=r"^[0-9A-Za-z]{6,12}$"),
                    f("anexo_passaporte", "Cópia do passaporte", "file"),
                ],
                conf(None, "Residência temporária, permanente ou vitalícia (Diploma Ministerial n.º 18/2024)."),
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
                [f("n_estudante", "N.º de estudante", pattern=r"^\d{5,10}$", help="Está no cartão de estudante.")],
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
                [f("factura", "N.º da factura", pattern=r"^\d{5,12}$", help="Está no topo da factura do hospital.")],
                conf("hospital"),
            ),
        ],
    ),
    (
        "outros",
        "emose",
        "Empresa Moçambicana de Seguros (EMOSE)",
        [
            (
                "premio",
                "Prémio de seguro",
                L1,
                CONSULTA,
                None,
                [
                    f(
                        "apolice",
                        "N.º da apólice",
                        pattern=r"^[0-9A-Za-z/-]{5,20}$",
                        help="Está no contrato ou no cartão do seguro.",
                    )
                ],
                conf("apolice"),
            ),
        ],
    ),
]
