# Web (Next.js) a partir da raiz do repositório (precisa de packages/api-client).
# Duas fases: constrói com tudo, mas a imagem final só leva o servidor "standalone" (centenas de MB a menos).
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages ./packages
RUN npm ci --workspaces --include-workspace-root --ignore-scripts
COPY apps/web apps/web
ARG API_URL
ENV API_URL=$API_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w apps/web

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
CMD ["node", "apps/web/server.js"]
