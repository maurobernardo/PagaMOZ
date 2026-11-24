# ADR-004 — Comprovativos verificáveis

**Estado:** aceite · **Data:** 2026-11-24

## Decisão
- Emitido uma vez, na confirmação do pagamento (tarefa Celery após commit; o download emite se ainda não existir).
- Conteúdo mínimo: referência, instituição, serviço, valores, método, data/hora (Maputo). **Sem** telefone,
  NUIT, nome ou dados do formulário — quem verifica não precisa deles.
- Integridade em duas camadas:
  1. **Registo:** `content_hash` (SHA-256 do JSON canónico) + `signature` (HMAC-SHA256 com `RECEIPT_SIGNING_KEY`).
     Alterar o registo na base de dados → verificação devolve `adulterado`.
  2. **Ficheiro:** PDF gerado de forma determinística (ReportLab `invariant=1`) e guardado; o seu SHA-256 fica
     registado. Carregar um PDF em `/verificar` só é válido se for byte a byte o emitido.
- QR + código curto (`XXXXX-XXXXX`, ~50 bits) abrem `/verificar/{código}`. O estado é o **actual** do pagamento:
  um pagamento devolvido mostra o comprovativo como `anulado`.
- Marca de água "DEMONSTRAÇÃO" e aviso na página de verificação enquanto `DEMO_MODE`.

## Alternativas adiadas
- Assinatura assimétrica (Ed25519) no QR para verificação **offline** por fiscais sem rede. Exige gestão de chaves
  e publicação da chave pública; avaliar com instituições na Fase 8.
- PDF/A e assinatura digital qualificada: só fazem sentido com uma entidade certificadora reconhecida.
