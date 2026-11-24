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
