# ADR-003 — Ledger, máquina de estados e simuladores

**Estado:** aceite · **Data:** 2026-11-24

## Lançamentos (centavos, sempre balanceados)

| Evento | Débito | Crédito |
|---|---|---|
| Confirmação | `provedor_a_receber` (total) | `instituicao_a_liquidar` (líquido) · `comissao_plataforma` (comissão) |
| Liquidação (split) | `instituicao_a_liquidar` (líquido) · `plataforma_recebido` (comissão) | `provedor_a_receber` (total) |
| Estorno antes de liquidar | `instituicao_a_liquidar` · `comissao_plataforma` | `provedor_a_receber` |

- Cada lançamento tem chave natural única (`confirm:PMZ…`) → reprocessar um evento não duplica dinheiro.
- `Journal`/`Posting` são append-only (modelo + queryset). Em Postgres, reforçar com REVOKE/trigger (Fase 8).
- "Liquidado" à instituição = soma dos `SettlementBatch`; o dinheiro nunca passa por conta da plataforma.

## Estados
`CRIADA → PENDENTE → CONFIRMADA → LIQUIDADA`, ramos `FALHADA`, `EXPIRADA`, `REVERTIDA`, `EM_DISPUTA`.
Só `payments.domain.transition()` muda o estado (lock de linha, mesmo estado = no-op).
`EXPIRADA → CONFIRMADA` é permitido: pagamento tardio tem de ser reconhecido, não perdido.
Falha recebida depois de confirmação é ignorada e fica para reconciliação.

## Simuladores
Um `SimulatedProvider` por método; o webhook simulado é assinado (HMAC-SHA256) e passa pelo mesmo
caminho que um webhook real. Cenários: sucesso, falha, atraso, timeout, duplicado, webhook_repetido.
Entregas com retry exponencial (5×) e `DeadLetter` no fim.

## Fora do âmbito por agora
Taxas do provedor (conta `provedor_taxas`) entram quando houver tarifário real de um parceiro.
