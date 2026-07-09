# Agente Cleexs

Plataforma multiagente — **Teo** (SEO/AEO) y futuros agentes.

## Stack

- **API** — Fastify + Prisma (`apps/api`)
- **Web** — Next.js backoffice Centro de Gestión (`apps/web`)
- **DB** — PostgreSQL

## Desarrollo local

```bash
cp .env.example .env
npm install
npm run docker:up          # Postgres en :5433
npx prisma migrate deploy
npm run db:seed
npm run dev                # API :4000 + Web :3000
```

## Deploy (Easypanel)

Ver [docs/deploy-easypanel.md](docs/deploy-easypanel.md).

| Servicio | Dockerfile | Puerto |
|----------|------------|--------|
| API | `apps/api/Dockerfile` | 4000 |
| Web | `apps/web/Dockerfile` | 3000 |
