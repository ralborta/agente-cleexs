FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspace=@agente/web --include-workspace-root

FROM base AS builder
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG WEB_BUILD_ID=20260910-growth-conversations-v2
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
# Validar que el contexto trae el módulo Comunicacional (rompe el build si Docker cacheó código viejo)
RUN set -eu; \
  echo "web build ${WEB_BUILD_ID}"; \
  date -u; \
  GROWTH_DIR='apps/web/src/app/[workspace]/growth'; \
  ls -la "$GROWTH_DIR"; \
  test -f "$GROWTH_DIR/conversations-panel.tsx"; \
  test -f "$GROWTH_DIR/creative-panel.tsx"; \
  grep -q 'Comunicacional' "$GROWTH_DIR/page.tsx"; \
  grep -q 'ConversationsPanel' "$GROWTH_DIR/page.tsx"; \
  rm -rf apps/web/.next
RUN npm run build --workspace=@agente/shared
RUN npm run build --workspace=@agente/web
# Validar el artefacto compilado antes de empaquetar la imagen
RUN set -eu; \
  grep -R -q 'Comunicacional' apps/web/.next/static/chunks/app || \
    (echo 'ERROR: Comunicacional no está en el build de Next'; ls -la 'apps/web/.next/static/chunks/app/[workspace]/growth' || true; exit 1); \
  grep -R -q 'conversations/status' apps/web/.next || \
    (echo 'ERROR: conversations/status no está en el build de Next'; exit 1)

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/next.config.js ./apps/web/next.config.js

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "run", "start"]
