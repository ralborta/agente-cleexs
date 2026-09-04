# AGENTS.md

## Cursor Cloud specific instructions

Monorepo (npm workspaces + Turborepo). Products: `apps/api` (Fastify API, port 4000),
`apps/web` (Next.js backoffice at route `/cleexs`, port 3000), `packages/shared`
(shared lib), and an optional WhatsApp bot in `bot/`. Standard commands live in the
root `package.json` and `README.md`; only the non-obvious caveats are listed here.

### Services & how to run (core loop = Postgres + API + Web)

- **PostgreSQL** is required. It is installed locally (not Docker) as cluster `16/main`
  on port **5432**, DB `agente_cleexs`, user/password `postgres`/`postgres`. It is NOT
  auto-started on VM boot — start it with `sudo pg_ctlcluster 16 main start` before
  running anything that touches the DB.
- A local `.env` already exists at the repo root with `DATABASE_URL` pointing at
  `localhost:5432` (the committed `.env.example` points at the Docker hostname `postgres:5432`,
  which only works inside Docker Compose). `.env` is gitignored.
- **Start dev servers:** `npm run dev` runs API (4000) + Web (3000) via Turborepo. The
  bot is NOT part of `npm run dev`; start it separately with `npm run bot:dev` (needs
  `npm run bot:install` first and an interactive WhatsApp QR scan — optional).

### CRITICAL caveat: the API dev process does not auto-load `.env`

`apps/api` runs `tsx watch src/index.ts`, which does NOT read `.env`. Only the Prisma
CLI (`prisma migrate`/`generate`/`db:seed`) auto-loads `.env`. If you run `npm run dev`
without exporting the vars first, the API boots but every DB query fails with
`Environment variable not found: DATABASE_URL`. Always load the env first:

```bash
sudo pg_ctlcluster 16 main start   # once per VM boot
set -a && source .env && set +a
npm run dev                        # API :4000 + Web :3000
```

### DB setup (already applied; re-run if you reset the DB)

```bash
npx prisma migrate deploy   # apply migrations
npm run db:seed             # seed workspace "cleexs", agent "teo", admin user
```

Seed creates login `admin@cleexs.net` / `demo1234` (workspace `cleexs`).

### Lint / build notes

- `npm run build` (Turborepo) builds all three packages; Next.js runs its own
  type-check + lint during `next build`, so this is the reliable full check.
- `npm run lint` for `@agente/web` runs `next lint`, which **hangs on first run** because
  there is no ESLint config file (it prompts interactively for setup with no TTY). Lint
  for `@agente/api` and `@agente/shared` are just `echo 'ok'`. Prefer `npm run build` to
  validate the web app's types/lint.

### Optional / external integrations (not needed for the core loop)

WordPress (publishing on approval), Google GSC/GA4 (metrics sync), OpenAI, and the
WhatsApp bridge all require external credentials and are optional. Approving a content
piece in the UI ("Aprobar → WP") calls WordPress and will error unless `WORDPRESS_*`
env vars are configured.
