# Pesquisa: instituições, dados pedidos e fluxos de pagamento

Base para o catálogo e para os perfis do conector simulado. Recolhido em 2026-11-25.
Tudo o que não tem fonte está marcado **[VERIFICAR]** e não entra como facto na interface.

> Os nomes das instituições são reais; **não** se usam logótipos nem identidade visual. As respostas das
> instituições (titulares, faturas, valores em dívida) são **geradas pelo simulador**: a integração real com
> cada instituição só se escreve depois de haver documentação oficial da sua API (ADR-001, `docs/conectores.md`).

| Instituição | Serviço | O que o cidadão indica | O que a instituição devolve | Fonte |
|---|---|---|---|---|
| EDM | Credelec (pré-pago) | N.º do contador + valor | Código de recarga para introduzir no contador | Campanha de actualização de contadores Credelec, sem a qual "o Credelec não aceitará novas recargas" ([AIM, 2024](https://aimnews.org/2024/08/20/edm-lanca-campanha-de-actualizacao-de-contadores/)); EDM a substituir contadores pós-pagos por Credelec ([Club of Mozambique](https://clubofmozambique.com/news/mozambique-edm-to-replace-almost-all-post-paid-electricity-meters-not-those-in-sensitive-services/)). Formato do contador (11 dígitos) e do código (20 dígitos, norma STS / IEC 62055-41) **[VERIFICAR]** — a norma existe ([IEC 62055-41:2018](https://webstore.iec.ch/publication/28425)) mas não confirmei os comprimentos. |
| EDM | Fatura pós-paga | N.º de cliente | Faturas em aberto | Mesma fonte (pós-pago ainda existe em serviços sensíveis). |
| AdRMM — Águas da Região Metropolitana de Maputo | Fatura de água | N.º de cliente | Faturas em aberto | Recenseamento de clientes até Fev/2025 ([Club of Mozambique](https://clubofmozambique.com/news/water-supply-customer-data-update-begins-in-greater-maputo/)); clientes com faturas em atraso ([360 Mozambique](https://360mozambique.com/business/companies/aguas-de-maputo-has-25000-customers-with-overdue-bills-valued-at-50m-meticals-per-month/)). |
| Autoridade Tributária | Impostos (GARE) | NUIT + referência da GARE | Imposto, período, valor | GARE gerada electronicamente e paga por referência única à AT, em bancos registados ([OCAM, 2024](https://ocam.org.mz/wp-content/uploads/2024/06/BREVE-INFORME_VISITA-_EXMA-DGI.pdf)). Pagamento por carteira móvel **[VERIFICAR]**. |
| INATTER | Multas de trânsito | Matrícula | Autos em dívida | Consulta de multas em consulta.inatter.gov.mz; multas por pagar impedem a renovação da carta ([CIP, 2023](https://www.cipmoz.org/wp-content/uploads/2023/01/INATRO-e-tribunais-1-3.pdf)). |
| INSS | Contribuições | NUIT da empresa + n.º da guia | Período, valor | Pagamento por "Guia de Pagamento de Contribuições", confirmada no sistema SISSMO ([Millennium bim](https://www.millenniumbim.co.mz/media/2036/minuta_de_pedido_de_pagamento_de_contribuicoes_ao_inss.pdf)). |
| Conselho Municipal de Maputo | Imposto Autárquico de Veículos (IAV) | Matrícula | Ano, valor | Prazo do IAV prorrogado em 2025 ([DLA Piper](https://www.dlapiperafrica.com/en/mozambique/insights/2025/Extension-of-the-Deadline-for-Payment-of-the-Municipal-Vehicle-Tax)). |
| Conselho Municipal de Maputo | IPRA (predial) | N.º do artigo matricial | Ano, valor | IPRA e TAE em processo de modernização ([CMM, 2024](https://cmmaputo.gov.mz/wp-content/uploads/2024/08/Relatorio-da-reuniao-tecnica-no-Conselho-Municipal-de-Maputo.pdf)). Identificador do prédio **[VERIFICAR]**. |
| SENAMI | Passaporte | Dados pessoais + BI | Pedido; recolha biométrica presencial | Taxas: **2 400,00 MT** normal, **2 775,00 MT** urgente — Diploma Ministerial n.º 18/2024 ([RSM](https://www.rsm.global/mozambique/en/news/actualizacao-das-taxas-cobradas-pela-concessao-renovacao-prorrogacao-ou-substituicao-do-passaporte-documentos-de-viagem-vistos-e-dire-em-mocambique); [DLA Piper](https://www.dlapiperafrica.com/pt/mozambique/insights/2024/Update-of-DIREs-and-Visas-fees)). |
| SENAMI | DIRE (cidadãos CPLP) | Dados + passaporte | Pedido | **29 310,00 MT** — mesmo diploma ([DLA Piper](https://www.dlapiperafrica.com/pt/mozambique/insights/2024/Update-of-DIREs-and-Visas-fees)). |
| UEM | Propinas | N.º de estudante | Prestações em dívida | Pagamentos pela rede Millennium bim; n.º de candidato/estudante usado nas referências ([recibo UEM 2025, Scribd](https://pt.scribd.com/document/960342023/pdf-2)). Valor por curso **[VERIFICAR]**. |
| Operadoras móveis | Recarga | Número + valor | Confirmação da recarga | Interligação M-Pesa, e-Mola e mKesh ([Banco de Moçambique, 2022](https://bancomoc.mz/media/h1uiyvps/entrada-em-funcionamento-da-interligação-entre-as-ime_10072022.pdf)). |
| TV por subscrição | Mensalidade | N.º de cliente / smartcard | Pacote e valor | Pagamento de TV e energia pelos canais bancários ([BCI](https://www.bci.co.mz/wp-content/uploads/2024/05/PAGAMENTO-DE-SERVICOS-Folheto-1.pdf)). |

Não incluídos por falta de fonte para a taxa: BI, certificado de registo criminal (só presencial, com impressões
digitais, segundo fonte secundária sem data — [CitizenX](https://citizenx.com/help/article/mozambique-prison-records)).
