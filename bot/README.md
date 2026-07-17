# Cleexs — bot WhatsApp (Baileys)

Bot self-hosted en EasyPanel. Reenvía mensajes a la API de agentes (`/api/webhooks/builderbot`) y envía respuestas cuando la API lo pide.

## ⚠️ CRÍTICO — no multiplicar conexiones

Misma falla que en BBC Cloud pago: **varias conexiones / reconexiones en loop → WhatsApp restringe el número**.

En EasyPanel (`wa-bot`):

1. **Réplicas = 1**
2. **Zero Downtime = OFF**
3. Redeploy: **Stop → Deploy → Start → un solo QR** (nunca deploy en caliente con sesión viva)
4. Si hay `conflict` / logout en logs: **parar el bot**, no reintentar en bucle
5. Tras un ban temporal: bot apagado hasta que pase; no escanees QR mientras tanto

Detalle: [docs/deploy-easypanel.md](../docs/deploy-easypanel.md) §9.

## Desarrollo local

```bash
cp bot/.env.example bot/.env
npm ci --prefix bot
npm run bot:dev --prefix bot
```

Escaneá el QR en consola o en `http://localhost:3008/`.

## Variables

| Variable | Descripción |
|----------|-------------|
| `AGENTE_API_URL` | API Fastify (local: `http://localhost:4000`) |
| `BOT_PUBLIC_URL` | URL para adjuntos temporales (local: `http://localhost:3008`) |
| `BOT_SESSION_NAME` | Nombre sesión Baileys (archivo QR: `{name}.qr.png`) |

En **EasyPanel**, servicio `cleexs-wa-bot`:

```env
PORT=3008
AGENTE_API_URL=http://agente-cleexs-api:4000
BOT_PUBLIC_URL=http://cleexs-wa-bot:3008
BOT_SESSION_NAME=cleexs
```

En la **API agentes**:

```env
BAILEYS_BOT_URL=http://cleexs-wa-bot:3008
CLEEXS_API_URL=https://api.cleexs.net
WHATSAPP_CHANNEL_API_KEY=...
```

Volúmenes recomendados:
- `/app/cleexs_sessions` — sesión WhatsApp
- `/app/data` — `db.json` del bot

## Endpoints

| Ruta | Uso |
|------|-----|
| `GET /` o `/v1/whatsapp/qr` | QR para vincular WhatsApp |
| `GET /health` | Estado de conexión |
| `POST /v1/messages` | Envío desde la API |
| `POST /v1/typing` | Indicador "escribiendo…" |
| `POST /v1/blacklist` | Pausar bot por número |
