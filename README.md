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
.\tasks.ps1 demo
```

Cria uma base nova com catálogo, utilizadores, 30 dias de pagamentos e divergências de reconciliação (1 a 2 minutos).
Guião da apresentação: `docs/guiao-demo.md`. API: `docs/api.md`. Produção: `docs/proximos-passos-producao.md`.

| Quem | Onde | Telefone | Palavra-passe |
|---|---|---|---|
| Cidadão | `/entrar` | qualquer | código OTP mostrado no ecrã |
| Instituição (admin) | `/portal` | `8400000NN` (01–15) | `DEMO_PASSWORD` do `.env` + código MFA mostrado |
| Equipa da plataforma | `/portal` → backoffice | `840000000` | idem |

## Observabilidade

- Cada resposta traz `X-Request-ID` (aceita o do proxy); logs em JSON com `LOG_JSON=true` (por omissão fora de `DEBUG`).
- `GET /metrics` (formato Prometheus) só com `Authorization: Bearer $METRICS_TOKEN`; sem token fica desligado.

## Fotografe e pague (OCR gratuito)

A leitura de faturas usa o Tesseract (código aberto, corre no servidor, sem custos nem envio de dados para fora).

- Docker: já instalado pela imagem (`tesseract-ocr` + `tesseract-ocr-por`).
- Windows (desenvolvimento): instale o Tesseract para Windows e o pacote de idioma português, e garanta que `tesseract` está no PATH.

Sem Tesseract, `POST /api/intel/scan` responde 503 a fotos, mas aceita o texto já lido em `text`.
