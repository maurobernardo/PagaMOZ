# PagaMOZ

Protótipo de plataforma de pagamento de serviços em Moçambique. **Ambiente de demonstração.**

## Arrancar (Windows, sem Docker)

```powershell
.\tasks.ps1 setup
.\tasks.ps1 up
```

- Web: http://localhost:3000 · Estado: http://localhost:3000/health
- API: http://localhost:8000/api/health · Docs: http://localhost:8000/api/docs

Outros: `.\tasks.ps1 test | lint | format | gen-client`. Com Docker: `make up-docker`.
Decisões em `docs/adr/`.

## Dados e acessos de demonstração

```powershell
.\tasks.ps1 seed-demo                                   # catálogo, instituições e utilizadores
apps\api\.venv\Scripts\python apps\api\manage.py seed_demo_activity     # 30 dias de pagamentos (demora)
apps\api\.venv\Scripts\python apps\api\manage.py demo_reconciliation --injectar
```

| Quem | Onde | Telefone | Palavra-passe |
|---|---|---|---|
| Cidadão | `/entrar` | qualquer | código OTP mostrado no ecrã |
| Instituição (admin) | `/portal` | `8400000NN` (01–15) | `DEMO_PASSWORD` do `.env` + código MFA mostrado |
| Equipa da plataforma | `/portal` → backoffice | `840000000` | idem |

## Observabilidade

- Cada resposta traz `X-Request-ID` (aceita o do proxy); logs em JSON com `LOG_JSON=true` (por omissão fora de `DEBUG`).
- `GET /metrics` (formato Prometheus) só com `Authorization: Bearer $METRICS_TOKEN`; sem token fica desligado.
