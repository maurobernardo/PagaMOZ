# O que falta para produção

O protótipo prova o fluxo e a arquitectura. Não está licenciado, não liga a nenhum sistema real e não processa dinheiro. Esta lista separa o que é decisão de negócio e regulação do que é trabalho técnico.

> Os pontos marcados `[VERIFICAR]` são afirmações regulatórias que não foram confirmadas em fonte oficial nesta fase. Têm de ser validadas com assessoria jurídica antes de entrarem em qualquer proposta.

## 1. Regulação e licenças (bloqueia tudo o resto)

- **Enquadramento da actividade.** Confirmar se uma plataforma que orquestra pagamentos sem custódia precisa de licença própria de prestador de serviços de pagamento, de registo como agregador, ou se pode operar ao abrigo da licença do parceiro. `[VERIFICAR: entidade supervisora do sistema de pagamentos em Moçambique e diploma aplicável]`
- **Contrato com o parceiro licenciado.** Tem de cobrir liquidação directa na conta da instituição, split da comissão, prazos de liquidação e acesso ao extracto diário para reconciliação.
- **Protecção de dados pessoais.** Confirmar o regime legal aplicável, a base legal para o tratamento, o prazo de retenção e se é obrigatório notificar ou registar a actividade junto de alguma autoridade. `[VERIFICAR: legislação de protecção de dados em vigor e autoridade competente]`
- **KYC/AML.** Definir os limites por cliente sem verificação de identidade, quando se exige o BI e quem reporta operações suspeitas: a plataforma ou o parceiro. `[VERIFICAR: obrigações de prevenção de branqueamento aplicáveis a este tipo de actividade]`
- **Cartões.** Nunca guardar dados de cartão. Usar a página de pagamento ou a tokenização do adquirente, para que o PCI DSS fique do lado dele.

## 2. Parceiros e integrações

| Item | O que é preciso | Estado |
|---|---|---|
| Carteiras móveis (M-Pesa, e-Mola, mKesh) | Contrato, credenciais de sandbox, documentação oficial da API | Simulador |
| Adquirente de cartões | Contrato, página de pagamento alojada/tokenização | Simulador |
| Referência bancária / QR | Banco parceiro e formato do ficheiro de retorno | Simulador |
| Primeira instituição (piloto) | API ou ficheiro de consulta e confirmação; contacto técnico | Simulador |

Regra mantida: **nenhum adaptador real sem documentação oficial**. Cada novo conector segue `docs/conectores.md`.

## 3. Homologação com cada instituição

1. Ambiente de testes da instituição ligado ao PagaMOZ em staging.
2. Casos de teste assinados por ambas as partes: consulta válida e inválida, pagamento confirmado, falhado e duplicado, estorno e reconciliação com divergência.
3. Um mês de piloto com volume limitado e reconciliação diária revista pelas duas equipas.
4. Passagem a produção por escrito.

## 4. Trabalho técnico pendente

**Segurança**
- Chaves (`SECRET_KEY`, `WEBHOOK_SECRET`, `RECEIPT_SIGNING_KEY`, `FIELD_ENCRYPTION_KEYS`) num cofre de segredos e com rotação documentada.
- Um segredo HMAC por provedor (hoje é um único para todos) e lista de IPs autorizados para os webhooks.
- CSP com nonce no Next.js, para deixar de precisar de `'unsafe-inline'` nos scripts.
- Códigos de recuperação do MFA e processo de reposição de acesso.
- Assinatura assimétrica no QR do comprovativo, para se poder verificar offline (ADR-004).
- Testes de intrusão por uma entidade independente.

**Operação**
- Postgres gerido, com backups testados (restaurar, não só copiar) e réplica de leitura para relatórios.
- Redis e workers Celery separados da API; o `CELERY_TASK_ALWAYS_EAGER` deixa de estar activo.
- Painéis e alertas sobre `/metrics`: taxa de sucesso por método, falhas por rever, divergências abertas, latência p95.
- Logs JSON centralizados, com retenção alinhada com a política de dados.
- Teste de carga repetido em staging com gunicorn e Postgres (`infra/load/carga.py`).

**Produto**
- Gateway de SMS para o OTP (hoje o código aparece no ecrã em modo demo).
- Notificações e lembretes de prazos (SMS e WhatsApp).
- Service worker para o PWA funcionar offline.
- Convites para membros das instituições, com definição de palavra-passe por link.

## 5. Variáveis obrigatórias em produção

```
DEBUG=false
DEMO_MODE=false
SECRET_KEY=...
WEBHOOK_SECRET=...
RECEIPT_SIGNING_KEY=...
FIELD_ENCRYPTION_KEYS=...           # Fernet; várias separadas por vírgula para rotação
DATABASE_URL=postgres://...
REDIS_URL=redis://...
ALLOWED_HOSTS=...
CSRF_TRUSTED_ORIGINS=https://...
PUBLIC_WEB_URL=https://...
METRICS_TOKEN=...
SECURE_HSTS_SECONDS=31536000        # só depois de confirmar HTTPS em todos os subdomínios
```

Com estas variáveis, `manage.py check --deploy` deixa só dois avisos, ambos intencionais: HSTS em subdomínios e preload.
Activar `SECURE_HSTS_INCLUDE_SUBDOMAINS` (e o preload) só depois de confirmar HTTPS em todos os subdomínios, porque não se
desfaz depressa. Sem `FIELD_ENCRYPTION_KEYS` a aplicação recusa arrancar fora de `DEBUG`.
