# ADR-001 — Modelo de dinheiro: orquestrar, não custodiar

**Estado:** aceite · **Data:** 2026-11-24

## Contexto
A plataforma cobra pagamentos de cidadãos para muitas instituições. Reter fundos exigiria
enquadramento como instituição de pagamento/moeda electrónica, com requisitos de capital e supervisão.

## Decisão
O valor pago liquida **directamente** na conta/merchant da instituição através de um gateway ou
parceiro licenciado. A comissão da plataforma é cobrada por *split* no parceiro quando possível,
ou facturada à instituição. O ledger de dupla entrada é um **espelho contabilístico** dos eventos
(fundos em trânsito, a liquidar, comissão), não um saldo detido pela plataforma.

## Consequências
- Cada parceiro é um `PaymentProvider`/`SettlementProvider`; no protótipo, simuladores.
- Reconciliação diária obrigatória (estado do parceiro vs. ledger).
- O enquadramento legal exacto tem de ser confirmado com o regulador e assessoria jurídica antes
  de produção — ver `docs/compliance.md`.
