# Web (Next.js) a partir da raiz do repositório (precisa de packages/api-client).
FROM node:22-alpine
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages ./packages
RUN npm ci --workspaces --include-workspace-root --ignore-scripts
COPY apps/web apps/web
ARG API_URL
ENV API_URL=$API_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w apps/web
ENV NODE_ENV=production PORT=3000
CMD ["npm", "run", "start", "-w", "apps/web"]
