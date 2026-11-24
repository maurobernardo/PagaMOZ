# API — guia rápido

Referência completa (OpenAPI): `GET /api/schema` · interface: `/api/docs`. O cliente TypeScript em
`packages/api-client` é gerado do mesmo schema (`.\tasks.ps1 gen-client`).

## Autenticação

| Quem | Como | Sessão |
|---|---|---|
| Cidadão | `POST /api/auth/otp/request` → `POST /api/auth/otp/verify` | cookie de sessão |
| Instituição / equipa | `POST /api/auth/portal/login` → (`/mfa/setup`) → `/mfa/verify` | cookie de sessão com MFA |
| Provedor de pagamento | HMAC-SHA256 do corpo em `X-Signature` | — |
| Monitorização | `Authorization: Bearer $METRICS_TOKEN` em `/metrics` | — |

A web chama a API pelo mesmo domínio (`/api/*` é reencaminhado pelo Next), por isso os pedidos que alteram dados levam
`X-CSRFToken` com o valor do cookie `csrftoken`.

## Pagar (cidadão)

```http
POST /api/catalog/services/12/quote        {"fields": {"contrato": "12345678"}}     → {id, amount, total, holder…}
POST /api/payments
Idempotency-Key: 6f1c…                      (8–80 caracteres, um por tentativa)
{"service": 12, "quote": "Q…", "method": "mpesa", "payer_phone": "+258841234567"}   → 201 {reference, status: "PENDENTE", instructions}
GET  /api/payments/PMZ…                     → estado actual
GET  /api/payments/PMZ…/receipt.pdf         → comprovativo (quando pago)
```

- Repetir o mesmo `POST` com a mesma chave devolve o mesmo pagamento (`200`, `Idempotent-Replay: true`).
  A mesma chave com outro corpo dá `409`.
- Valor fixo: sem `quote`. Valor aberto: `amount` em centavos. Nível 3: primeiro `POST /api/requests` (multipart) e depois `request`.
- Todos os valores são **inteiros em centavos** (MZN).

## Webhook do provedor

```http
POST /api/webhooks/mpesa
X-Signature: hex(hmac_sha256(WEBHOOK_SECRET, corpo))
{"event_id": "…", "provider_ref": "…", "reference": "PMZ…", "status": "pago" | "falhou"}
```

Resposta `200 {"outcome": …}`, que pode ser `aplicado`, `ja_aplicado`, `repetido`, `ignorado_*` ou `transaccao_desconhecida`.
Um `event_id` repetido nunca é aplicado duas vezes. Assinatura inválida dá `401`.

## Portal da instituição — `/api/portal/{slug}/…`

`dashboard`, `transactions` (filtros e `?export=csv|xlsx`), `transactions/{ref}/reverse`, `settlements`, `balances`,
`reconciliation`, `requests`, `services`, `members`. Membros de outra instituição recebem **404** (não se revela se existe).

## Backoffice — `/api/backoffice/…`

Só `is_staff` com MFA: `overview`, `institutions`, `transactions`, `discrepancies`, `reconciliation/run`,
`dead-letters`, `audit`, `providers`, `parameters`.

## Erros

DRF padrão: `{"detail": "…"}` ou `{"campo": ["…"]}`; nos campos do serviço, `{"fields": {"contrato": "Formato inválido."}}`.
Limites de pedidos dão `429`. Cada resposta traz `X-Request-ID`; indique-o ao reportar um problema.
