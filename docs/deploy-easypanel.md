# Deploy en Easypanel — Agente Cleexs

Stack: **PostgreSQL** + **API (Fastify)** + **Web (Next.js)**

Dominios sugeridos:
- Backoffice: `https://agents.cleexs.net`
- API: `https://api-agents.cleexs.net`

---

## 1. Subir el código a Git

Easypanel despliega desde un repositorio Git. Asegurate de que el repo incluya:

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `prisma/migrations/`
- `docker-compose.prod.yml` (referencia)

---

## 2. Crear PostgreSQL en Easypanel

1. **Nuevo servicio** → **PostgreSQL 16**
2. Anotá la URL interna, ej:
   ```
   postgresql://postgres:TU_PASSWORD@agente-pg:5432/agente_cleexs
   ```
3. Creá la base `agente_cleexs` si el template no la crea sola.

---

## 3. Servicio API

| Campo | Valor |
|-------|-------|
| Tipo | App → Docker |
| Repo | tu repo Git |
| Dockerfile | `apps/api/Dockerfile` |
| Context | `/` (raíz del repo) |
| Puerto | `4000` |
| Dominio | `api-agents.cleexs.net` |

### Variables de entorno (API)

```env
DATABASE_URL=postgresql://postgres:PASSWORD@NOMBRE_SERVICIO_PG:5432/agente_cleexs?schema=public
API_PORT=4000
JWT_SECRET=generar-secreto-largo
CRON_SECRET=generar-secreto-cron
FRONTEND_URL=https://agents.cleexs.net
FRONTEND_URLS=https://agents.cleexs.net
DISABLE_AUTONOMOUS=true
RUN_DB_SEED=true
WORDPRESS_URL=https://cleexs.net
WORDPRESS_USERNAME=...
WORDPRESS_APP_PASSWORD=...
WORDPRESS_APPROVAL_STATUS=draft
WORDPRESS_CATEGORY_ID=18
```

> **Primera vez:** `RUN_DB_SEED=true` crea workspace Cleexs, agente Teo y usuario `admin@cleexs.net` / `demo1234`. Cambiá la contraseña después.

Al arrancar, la API ejecuta `prisma migrate deploy` automáticamente.

---

## 4. Servicio Web (backoffice)

| Campo | Valor |
|-------|-------|
| Tipo | App → Docker |
| Dockerfile | `apps/web/Dockerfile` |
| Context | `/` |
| Puerto | `3000` |
| Dominio | `agents.cleexs.net` |

### Build args (importante)

```env
NEXT_PUBLIC_API_URL=https://api-agents.cleexs.net
```

En Easypanel, agregalo como **Build Argument** o variable de build. Next.js lo necesita en tiempo de compilación.

---

## 5. Verificar deploy

```bash
# Health API
curl https://api-agents.cleexs.net/health

# Backoffice
open https://agents.cleexs.net/cleexs
```

Respuesta esperada de `/health`:
```json
{"status":"ok","service":"agente-api",...}
```

---

## 6. Cron de misiones autónomas (opcional)

Cuando quieras activar Teo autónomo:

1. En API: `DISABLE_AUTONOMOUS=false`
2. En Easypanel, creá un **Cron Job** que llame cada hora:

```bash
curl -X POST https://api-agents.cleexs.net/api/cron/autonomous-tick \
  -H "x-cron-secret: TU_CRON_SECRET"
```

---

## 7. Deploy local con Docker (alternativa)

```bash
cp .env.example .env
# Editá .env con tus valores

docker compose -f docker-compose.prod.yml up -d --build
```

- API: http://localhost:4000/health
- Web: http://localhost:3000/cleexs

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| API no conecta a Postgres | Verificá `DATABASE_URL` con hostname interno de Easypanel |
| Web no carga datos | Revisá `NEXT_PUBLIC_API_URL` (debe ser la URL pública de la API) |
| CORS error | Agregá el dominio del backoffice en `FRONTEND_URLS` |
| Migraciones fallan | Revisá logs de API al arrancar; Postgres debe estar healthy |
| WP publish falla | Verificá credenciales `WORDPRESS_*` en el servicio API |
| GSC/GA4 sin datos | Service account agregada en GSC + GA4; `GA4_PROPERTY_ID` configurado |

---

## 8. Google Search Console + GA4

### Service account (proyecto GCP **Cleexs**)

Email: `agente-teo-metrics@gen-lang-client-0925506379.iam.gserviceaccount.com`

1. **Search Console** → Configuración → Usuarios → agregar email con permiso **Completo** (o mínimo ver datos)
2. **GA4** → Admin → Acceso a la propiedad → agregar email como **Lector**
3. Anotar **Property ID** de GA4 (Admin → Detalles de la propiedad)

### Variables API

```env
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
GSC_SITE_URL=https://cleexs.net/
GA4_PROPERTY_ID=123456789
```

### Probar conexión

```bash
curl -X POST https://agente-cleexs-api.wd75db.easypanel.host/api/integrations/cleexs/google/test
```

### Sync diario (cron Easypanel)

```bash
curl -X POST https://agente-cleexs-api.wd75db.easypanel.host/api/cron/metrics-sync \
  -H "x-cron-secret: TU_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"workspace":"cleexs"}'
```

Programar 1 vez por día (ej. 6:00 AM).

---

## 9. Bot WhatsApp (Baileys self-hosted)

Servicio aparte en EasyPanel, patrón Andreu.

| Campo | Valor |
|-------|-------|
| Tipo | App → Docker |
| Dockerfile | `bot/Dockerfile` |
| Context | `/bot` |
| Puerto | `3008` |
| Dominio (opcional) | `wa-bot.cleexs.net` o solo interno |

### Variables bot (`cleexs-wa-bot`)

```env
PORT=3008
AGENTE_API_URL=http://agente-cleexs-api:4000
BOT_PUBLIC_URL=http://cleexs-wa-bot:3008
BOT_SESSION_NAME=cleexs
MEDIA_DIR=/app/assets/inbound
BOT_DB_PATH=/app/data/db.json
```

Volúmenes:
- `/app/cleexs_sessions` — sesión WhatsApp (no perder al redeploy)
- `/app/data` — `db.json` del bot

### Variables API agentes (agregar al servicio API)

```env
BAILEYS_BOT_URL=http://cleexs-wa-bot:3008
CLEEXS_API_URL=https://api.cleexs.net
WHATSAPP_CHANNEL_API_KEY=...mismo que Railway Cleexs...
```

### Vincular WhatsApp

1. Abrí `https://TU-DOMINIO-BOT/` o el puerto 3008 → escaneá QR.
2. Verificá: `curl http://cleexs-wa-bot:3008/health`
3. API agentes: `curl https://api-agents.cleexs.net/api/whatsapp/status`

### Flujo de mensajes

```
Cliente WA → cleexs-wa-bot → POST /api/webhooks/builderbot (API agentes)
                                    ↓ si hay URL
                              Cleexs API /diagnostic/whatsapp/url
                                    ↓ reply
                              Bot envía respuesta al cliente
```

### Cleexs Railway (envíos salientes desde diagnóstico)

En la API de Cleexs (Railway), agregá:

```env
BAILEYS_BOT_URL=https://wa-bot.cleexs.net
```

(o URL interna si comparten red; en prod suele ser el dominio público del bot en EasyPanel)

Podés mantener `BUILDERBOT_*` como fallback hasta cortar BBC.
