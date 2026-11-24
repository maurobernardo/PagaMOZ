# Teste de carga e revisão de segurança (Fase 8)

## Carga

`infra/load/carga.py` simula o percurso do cidadão: catálogo → consulta → pagamento (M-Pesa simulado) → estado.

Medição em 2026-11-24, num portátil Windows, com o servidor de desenvolvimento do Django, SQLite e Celery em modo eager
(o webhook simulado, a notificação e o PDF correm dentro do próprio pedido de pagamento). 10 utilizadores simultâneos durante 45 s:

| Passo | p50 | p95 | p99 | Erros |
|---|---|---|---|---|
| Catálogo | 130 ms | 545 ms | 741 ms | 0 |
| Consulta | 272 ms | 1,9 s | 4,3 s | 0 * |
| Pagamento | 2,3 s | 6,7 s | 12,0 s | 0 |
| Estado | 194 ms | 573 ms | 995 ms | 0 |

Cerca de 11 pedidos/s no total. \* Os erros de consulta que apareceram vinham do script, que gerava valores inválidos para alguns
serviços (já corrigido).

**O que estes números dizem:** o limite está na configuração de desenvolvimento, não no desenho. O pagamento é lento porque,
em modo eager, o pedido espera pelo webhook, pela notificação e pelo PDF, e o SQLite serializa as escritas. Em produção estas
tarefas vão para workers Celery e a base é Postgres. **Repetir em staging antes de qualquer piloto.**

**Corrigido durante o teste:** com escritas concorrentes, o SQLite devolvia `database is locked` (29 de 48 pagamentos falharam).
A configuração passou a WAL, com espera de 20 s e transacções `IMMEDIATE` (`config/settings.py`). Com isso, os erros nos pagamentos
passaram a zero. Isto também protege a demo quando várias pessoas usam o portátil ao mesmo tempo.

Como correr:

```powershell
$env:LOAD_TEST="true"; $env:DEBUG="true"; apps\api\.venv\Scripts\python apps\api\manage.py runserver 8001
```

```powershell
apps\api\.venv\Scripts\python infra\load\carga.py --url http://127.0.0.1:8001 --utilizadores 10 --segundos 45
```

Use `127.0.0.1` e não `localhost`: no Windows, `localhost` tenta primeiro IPv6 e cada pedido perde cerca de 2 s.
`LOAD_TEST` desliga os limites de pedidos e só é aceite com `DEBUG=true`.

## Revisão de segurança — o que mudou nesta fase

| Achado | Risco | Correcção |
|---|---|---|
| `/admin/` do Django aceitava staff sem MFA | Acesso ao backoffice só com palavra-passe | Desligado fora de dev (`ADMIN_ENABLED`) |
| `DEMO_MODE` ligado por omissão | Em produção, códigos OTP/MFA devolvidos na resposta | Por omissão igual a `DEBUG` |
| Sem regras de palavra-passe | Palavras-passe fracas no portal | Validadores do Django, mínimo 12 caracteres |
| Segredo TOTP em claro na base | Fuga da base = MFA comprometido | Cifrado em repouso (Fernet, com rotação) + migração dos existentes |
| Auditoria e ledger imutáveis só na aplicação | SQL directo poderia alterar | Triggers Postgres recusam `UPDATE`/`DELETE` (testado no CI) |
| Sem HSTS nem redireccionamento HTTPS | Downgrade para HTTP | `SECURE_SSL_REDIRECT`, HSTS configurável; `check --deploy` só com os 2 avisos de HSTS intencionais |
| Sem CSP | XSS teria impacto maior | CSP restrita à própria origem (`'unsafe-inline'` nos scripts por agora) |
| Limites de pedidos fixos no código | Difícil ajustar sem novo deploy | Centralizados em `THROTTLE_RATES` |

Já existiam e foram confirmados nesta revisão:
- isolamento entre instituições (404) em todos os endpoints do portal;
- idempotência dos pagamentos e dos webhooks;
- assinatura HMAC nos webhooks;
- anexos verificados pelos primeiros bytes;
- protecção contra fórmulas na exportação para Excel;
- redireccionamento aberto bloqueado no login;
- request-id validado (sem injecção nos logs);
- bloqueio após 5 tentativas de palavra-passe;
- códigos TOTP de uso único.

O que fica por fazer está em `docs/proximos-passos-producao.md` §4.
