# Guia de conectores

Cada `Service` tem `integration_level` (1, 2, 3), `connector` (nome no registo) e `connector_config` (JSON).

| Nível | Fluxo do cidadão | API |
|---|---|---|
| 1 — consulta + pagamento | introduz contador/contrato → vê valor e titular mascarado → paga | `POST /api/catalog/services/{id}/quote` → `POST /api/payments` com `quote` |
| 2 — referência | introduz referência (ou taxa fixa) → paga | igual ao 1 quando `pricing=consulta`; senão `fields` (+ `amount` se aberto) |
| 3 — pedido assistido | formulário + anexos → paga → acompanha estado | `POST /api/requests` (multipart) → `POST /api/payments` com `request` |

Regras:
- Valor por consulta **só** vem de uma cotação (`Quote`) do conector: uso único, com validade, presa ao serviço. O cidadão nunca define o valor.
- Depois de `CONFIRMADA`, `connector.confirm_payment()` notifica a instituição (retry exponencial, 8×, depois `DeadLetter`). O pagamento não depende desta notificação.
- Pedido de nível 3 passa a `SUBMETIDO` na mesma transacção que confirma o pagamento. A instituição avança-o no portal: `EM_ANALISE → PENDENTE_INFO/APROVADO → PRONTO → CONCLUIDO` (ou `REJEITADO`, com nota obrigatória).
- Anexos: PDF/JPG/PNG verificados pelos bytes iniciais, máx. 5 MB, guardados fora da pasta pública, só descarregáveis pelo portal da instituição dona.

## Simulador (`connector = "simulado"`)

Determinístico pelos dados introduzidos. `connector_config`: `min`, `max` (centavos), `valid_minutes`,
`not_found_suffix` (omissão `0000` → 404) e `unavailable_suffix` (omissão `9999` → 503).

## Adicionar um conector real

1. Obter documentação oficial e credenciais de sandbox da instituição. **Sem documentação oficial, não se escreve o adaptador.**
2. Criar `connectors/adapters/<nome>.py` com uma classe que implementa `ServiceConnector` (`lookup`, `confirm_payment`, `reverse`, `request_status`).
3. Erros de negócio → `LookupError_` (mensagem para o cidadão); falhas técnicas → `ConnectorUnavailable`.
4. Registar em `CONNECTORS` e mudar `Service.connector` dos serviços dessa instituição.
5. Testes com respostas gravadas do sandbox; nunca chamadas reais no CI.
