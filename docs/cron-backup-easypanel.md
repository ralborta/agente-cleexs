# Cron de respaldo — Easypanel / servidor

Teo tiene un **scheduler interno** en la API (`DISABLE_AUTONOMOUS=false`, tick cada 1h).  
Los crons externos son **respaldo** por si la API se reinicia o querés forzar sync desde fuera.

## Variables requeridas (API Easypanel)

```env
DISABLE_AUTONOMOUS=false
AUTONOMOUS_TICK_MS=3600000
CRON_SECRET=tu-secreto-largo
API_PUBLIC_URL=https://agente-cleexs-api.wd75db.easypanel.host
```

## Endpoints

| Job | Método | URL | Frecuencia sugerida |
|-----|--------|-----|---------------------|
| Tick autónomo | POST | `/api/cron/autonomous-tick` | Cada hora |
| Sync métricas GSC/GA4 | POST | `/api/cron/metrics-sync` | 1× día (6:00 AM) |
| Refrescador | POST | `/api/cron/refresher-scan` | Incluido en tick autónomo |

Header en todos: `x-cron-secret: TU_CRON_SECRET`

## Comandos curl

### Tick autónomo (hora)

```bash
curl -sS -X POST "https://agente-cleexs-api.wd75db.easypanel.host/api/cron/autonomous-tick" \
  -H "x-cron-secret: TU_CRON_SECRET"
```

### Sync métricas (diario)

```bash
curl -sS -X POST "https://agente-cleexs-api.wd75db.easypanel.host/api/cron/metrics-sync" \
  -H "x-cron-secret: TU_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"workspace":"cleexs"}'
```

## Dónde programarlos

### Opción A — Crontab del servidor Easypanel

Si tenés SSH al host:

```cron
0 * * * * curl -sS -X POST "https://agente-cleexs-api.wd75db.easypanel.host/api/cron/autonomous-tick" -H "x-cron-secret: TU_CRON_SECRET" >/dev/null 2>&1
0 6 * * * curl -sS -X POST "https://agente-cleexs-api.wd75db.easypanel.host/api/cron/metrics-sync" -H "x-cron-secret: TU_CRON_SECRET" -H "Content-Type: application/json" -d '{"workspace":"cleexs"}' >/dev/null 2>&1
```

### Opción B — Servicio externo (cron-job.org, Uptime Robot, etc.)

Crear job HTTP POST con el mismo curl y el header `x-cron-secret`.

### Opción C — Desde el backoffice (manual)

Integraciones → **Ejecutar tick ahora** (requiere login admin).

## Qué hace cada tick autónomo

1. Sync métricas GSC/GA4 (si pasó ≥24h desde el último snapshot)
2. Escaneo refrescador + posible misión de refresco
3. Nueva misión autónoma si pasó el intervalo de frecuencia (`2/semana` ≈ cada 4 días)

## Verificar

```bash
curl -s https://agente-cleexs-api.wd75db.easypanel.host/health
# "autonomous": true
```

Backoffice → Integraciones → panel **Teo en modo autónomo**.
