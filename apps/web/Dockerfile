FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspace=@agente/web --include-workspace-root

FROM base AS builder
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG WEB_BUILD_ID=20260910-growth-conversations
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
# Bust de cache DESPUÉS del COPY para forzar rebuild con el código nuevo de Growth
RUN echo "web build ${WEB_BUILD_ID}" && date -u && test -f apps/web/src/app/\[workspace\]/growth/conversations-panel.tsx
RUN npm run build --workspace=@agente/shared
RUN npm run build --workspace=@agente/web

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
