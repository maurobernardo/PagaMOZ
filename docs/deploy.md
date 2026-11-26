# Pôr o PagaMOZ no ar

## 1. API no VPS (Hostinger, Ubuntu 24.04)

```bash
# no VPS, uma vez
curl -fsSL https://get.docker.com | sh
git clone <repositório> /opt/pagamoz && cd /opt/pagamoz/infra/prod
cp .env.example .env   # preencher: senhas, SECRET_KEY, domínio da Vercel
docker compose up -d --build
docker compose exec api python manage.py seed_demo   # catálogo de demonstração
```

O Caddy pede o certificado HTTPS sozinho para `API_DOMAIN` (portas 80 e 443 abertas na firewall da Hostinger).
Teste: `https://srv2066467.hstgr.cloud/api/catalog/categories`.

Actualizar: `git pull && docker compose up -d --build`.

## 2. Web na Vercel

- Importar o repositório; **Root Directory** `apps/web`.
- Variável `API_URL=https://srv2066467.hstgr.cloud` (a web passa `/api/*` para lá).
- Depois de ter o domínio da Vercel, pô-lo em `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS` no `.env` do VPS e reiniciar a API.

## 3. APK Android

```powershell
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

O link do APK aparece no fim. As moradas da API e da web estão em `eas.json` (perfil `preview`).
