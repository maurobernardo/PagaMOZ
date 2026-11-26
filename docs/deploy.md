# Pôr o PagaMOZ no ar

## 1. API no VPS (Hostinger) — feito

- Código em `/opt/pagamoz`, `.env` em `/opt/pagamoz/infra/prod/.env` (senhas geradas no VPS, só lá).
- Projecto Docker `pagamoz`: db, redis, api, worker, beat. A API entra na rede `deploy_default` como `pagamoz-api`.
- HTTPS pelo Caddy já existente (`/opt/terra/deploy/Caddyfile`, bloco de `Caddyfile.snippet`; cópia antiga em `Caddyfile.bak-antes-pagamoz`).
- Actualizar (do PC): `git archive HEAD | ssh -i ~/.ssh/pagamoz_vps root@89.117.37.161 "tar -x -C /opt/pagamoz && cd /opt/pagamoz/infra/prod && docker compose -p pagamoz up -d --build"`.

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
