"""Dados de demonstração. Todas as instituições são FICTÍCIAS; qualquer semelhança é coincidência.

Valores em centavos (MZN x 100). Formato do serviço:
(slug, nome, nível, pricing, valor, campos)
"""

L1, L2, L3 = 1, 2, 3
FIXO, CONSULTA, ABERTO = "fixo", "consulta", "aberto"


def f(name, label, type="text", required=True, pattern=""):
    d = {"name": name, "label": label, "type": type, "required": required}
    if pattern:
        d["pattern"] = pattern
    return d


CONTADOR = f("contador", "N.º do contador", pattern=r"^\d{11}$")
CONTRATO = f("contrato", "N.º de contrato/cliente", pattern=r"^\d{6,10}$")
REFERENCIA = f("referencia", "Referência de pagamento", pattern=r"^[A-Z0-9]{8,15}$")
NOME = f("nome_completo", "Nome completo")
DATA_NASC = f("data_nascimento", "Data de nascimento", "date")
ESTUDANTE = f("n_estudante", "N.º de estudante", pattern=r"^\d{8}$")
MATRICULA = f("matricula", "Matrícula do veículo", pattern=r"^[A-Z]{3}-\d{3}-[A-Z]{2}$")
ANEXO_BI = f("anexo_bi", "Cópia do documento de identificação", "file")
NUIT = f("nuit", "NUIT", pattern=r"^\d{9}$")

CATEGORIES = [
    ("documentos", "Documentos e identificação", "id-card", "BI, passaporte, certidões, registo criminal"),
    ("transportes", "Transportes e trânsito", "car", "Carta de condução, veículos, multas"),
    ("servicos-basicos", "Água, energia e serviços básicos", "bolt", "Água, electricidade, recargas, internet"),
    ("impostos", "Impostos e serviços governamentais", "landmark", "IVA, IRPS, IRPC, taxas e licenças"),
    ("educacao", "Educação", "graduation-cap", "Propinas, matrículas, exames, certificados"),
    ("saude", "Saúde", "heart-pulse", "Consultas, exames, taxas hospitalares, seguros"),
    ("municipios", "Municípios e serviços locais", "building", "Mercados, licenças, lixo, construção"),
    ("outros", "Outros", "grid", "Seguros, eventos, viagens, subscrições"),
]

# (categoria, slug, nome, banco, [serviços])
INSTITUTIONS = [
    (
        "documentos",
        "registo-civil-demo",
        "Conservatória Central de Registos",
        "Banco Horizonte",
        [
            ("certidao-nascimento", "Certidão de nascimento", L3, FIXO, 25_000, [NOME, DATA_NASC, ANEXO_BI]),
            ("certidao-casamento", "Certidão de casamento", L3, FIXO, 30_000, [NOME, ANEXO_BI]),
            ("registo-criminal", "Registo criminal", L3, FIXO, 45_000, [NOME, DATA_NASC, ANEXO_BI]),
            ("autenticacao", "Autenticação de documentos", L2, FIXO, 10_000, [REFERENCIA]),
        ],
    ),
    (
        "documentos",
        "identificacao-demo",
        "Serviço Nacional de Identificação",
        "Banco Horizonte",
        [
            ("bi-renovacao", "Renovação do BI", L3, FIXO, 35_000, [NOME, DATA_NASC, ANEXO_BI]),
            ("passaporte", "Pedido de passaporte", L3, FIXO, 450_000, [NOME, DATA_NASC, ANEXO_BI]),
        ],
    ),
    (
        "transportes",
        "transito-demo",
        "Instituto de Trânsito Austral",
        "Banco Maré",
        [
            ("carta-renovacao", "Renovação de carta de condução", L3, FIXO, 120_000, [NOME, ANEXO_BI]),
            ("multa", "Pagamento de multa", L2, CONSULTA, None, [REFERENCIA]),
            ("taxa-circulacao", "Taxa de circulação", L2, CONSULTA, None, [MATRICULA]),
            ("inspeccao", "Inspecção de veículo", L2, FIXO, 80_000, [MATRICULA]),
        ],
    ),
    (
        "servicos-basicos",
        "energia-austral",
        "Energia Austral",
        "Banco Índico Comercial",
        [
            ("recarga", "Recarga de energia pré-paga", L1, ABERTO, None, [CONTADOR]),
            ("fatura", "Fatura de electricidade pós-paga", L1, CONSULTA, None, [CONTRATO]),
        ],
    ),
    (
        "servicos-basicos",
        "aguas-do-indico",
        "Águas do Índico",
        "Banco Maré",
        [
            ("fatura", "Fatura de água", L1, CONSULTA, None, [CONTRATO]),
            ("ligacao", "Pedido de nova ligação", L3, FIXO, 350_000, [NOME, ANEXO_BI]),
        ],
    ),
    (
        "servicos-basicos",
        "rede-acacia",
        "Rede Acácia Telecom",
        "Banco Horizonte",
        [
            ("internet", "Mensalidade de internet", L1, CONSULTA, None, [CONTRATO]),
            ("tv", "Subscrição de TV", L1, CONSULTA, None, [CONTRATO]),
            ("recarga-movel", "Recarga de telemóvel", L1, ABERTO, None, [f("numero", "Número", "phone")]),
        ],
    ),
    (
        "impostos",
        "autoridade-fiscal-demo",
        "Autoridade Fiscal",
        "Banco Central (conta demo)",
        [
            ("iva", "IVA", L2, CONSULTA, None, [NUIT, REFERENCIA]),
            ("irps", "IRPS", L2, CONSULTA, None, [NUIT, REFERENCIA]),
            ("irpc", "IRPC", L2, CONSULTA, None, [NUIT, REFERENCIA]),
            ("certidao-quitacao", "Certidão de quitação", L3, FIXO, 50_000, [NUIT]),
        ],
    ),
    (
        "impostos",
        "licenciamento-demo",
        "Balcão de Licenciamento Comercial",
        "Banco Horizonte",
        [
            ("alvara", "Alvará comercial", L3, FIXO, 250_000, [NUIT, ANEXO_BI]),
            ("taxa-administrativa", "Taxa administrativa", L2, ABERTO, None, [REFERENCIA]),
        ],
    ),
    (
        "educacao",
        "universidade-baobab",
        "Universidade Baobá",
        "Banco Maré",
        [
            ("propina", "Propina mensal", L1, CONSULTA, None, [ESTUDANTE]),
            ("inscricao", "Inscrição/matrícula", L2, FIXO, 150_000, [NOME]),
            ("exame", "Taxa de exame de recurso", L2, FIXO, 50_000, [ESTUDANTE]),
            ("certificado", "Pedido de certificado", L3, FIXO, 200_000, [ESTUDANTE, NOME]),
        ],
    ),
    (
        "educacao",
        "escola-tecnica-limpopo",
        "Escola Técnica do Vale",
        "Banco Índico Comercial",
        [
            ("propina", "Propina trimestral", L1, CONSULTA, None, [ESTUDANTE]),
            ("matricula", "Matrícula", L2, FIXO, 80_000, [NOME]),
        ],
    ),
    (
        "saude",
        "hospital-central-demo",
        "Hospital Central do Sol",
        "Banco Horizonte",
        [
            ("consulta", "Consulta externa", L2, FIXO, 20_000, [NOME]),
            ("exames", "Exames de diagnóstico", L2, CONSULTA, None, [REFERENCIA]),
            ("internamento", "Taxa de internamento", L2, CONSULTA, None, [REFERENCIA]),
        ],
    ),
    (
        "saude",
        "clinica-marula",
        "Clínica Marula",
        "Banco Maré",
        [
            ("consulta", "Consulta de especialidade", L2, FIXO, 250_000, [NOME]),
            ("laboratorio", "Análises clínicas", L2, ABERTO, None, [REFERENCIA]),
        ],
    ),
    (
        "municipios",
        "municipio-cidade-sol",
        "Município da Cidade do Sol",
        "Banco Índico Comercial",
        [
            ("taxa-mercado", "Taxa diária de mercado", L2, FIXO, 1_000, [f("banca", "N.º da banca")]),
            ("licenca-vendedor", "Licença de vendedor", L3, FIXO, 60_000, [NOME, ANEXO_BI]),
            ("recolha-lixo", "Taxa de recolha de lixo", L1, CONSULTA, None, [CONTRATO]),
            ("licenca-construcao", "Licença de construção", L3, FIXO, 500_000, [NOME, ANEXO_BI]),
            ("publicidade", "Licença de publicidade", L3, FIXO, 150_000, [NUIT]),
        ],
    ),
    (
        "outros",
        "seguros-tchova",
        "Seguros Tchova",
        "Banco Maré",
        [
            ("auto", "Seguro automóvel", L1, CONSULTA, None, [f("apolice", "N.º de apólice")]),
            ("saude", "Seguro de saúde", L1, CONSULTA, None, [f("apolice", "N.º de apólice")]),
        ],
    ),
    (
        "outros",
        "bilheteira-xigubo",
        "Bilheteira Xigubo",
        "Banco Horizonte",
        [
            ("concerto", "Bilhete de concerto", L2, FIXO, 100_000, [NOME]),
            ("autocarro", "Bilhete interprovincial", L2, ABERTO, None, [REFERENCIA]),
            ("associacao", "Quota de associação", L2, FIXO, 50_000, [NOME]),
        ],
    ),
]
