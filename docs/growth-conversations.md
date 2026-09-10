# Growth · Conversaciones

Módulo del agente Growth que encuentra hilos relevantes a artículos **ya publicados**, genera borradores de respuesta y mide intervenciones **después** de una publicación manual.

```
Teo publica artículo (Publication.url + publishedAt)
        │
        ▼
  Buscar conversaciones (manual; autoTrigger off por defecto)
        │
        ▼
  Queries → DataForSEO SERP (sandbox | live)
        │
        ▼
  Filtros → verify página (fechas / allowsReplies)
        │
        ▼
  Score (opportunityScore ≠ evidenceConfidence)
        │
        ▼
  Top N → borrador de respuesta
        │
        ▼
  UI: editar · copiar · aprobar (≠ publicado) · descartar
        │
        ▼
  Registro manual de publicación → GrowthIntervention (+ UTM)
        │
        ▼
  Métricas: GA4 opcional · contactos/comerciales manuales
        │
        ▼
  Topic insights → Discovery (revisables, no auto-prioridad)
```

## Config (`AgentConfig.settings.conversations`)

Claves bajo `settings.conversations` del agente `growth` (defaults en código):

| Clave | Default | Notas |
|-------|---------|--------|
| `autoTriggerOnPublish` | `false` | No dispara al publicar |
| `maxQueries` | `15` | Clamp 10–20 |
| `maxSerpResultsPerQuery` | `10` | |
| `maxPagesToVerify` | `30` | |
| `maxRecommended` | `5` | |
| `maxSpendUsd` | `2` | Techo estimado DFS |
| `locationCode` | `2032` | AR |
| `languageCode` | `es` | |
| `market` | `ar` | |
| `estimatedCostPerSerpUsd` | `0.002` | |
| `concurrency` | `3` | |
| `pageTimeoutMs` | `12000` | |
| `maxPageBytes` | `500000` | |
| `minOpportunityScore` | `0.35` | |
| `scoreWeights` | ver abajo | Se normalizan a sumar 1 |

### Pesos de score (default)

| Factor | Peso |
|--------|------|
| `problemFit` | 0.30 |
| `audienceFit` | 0.20 |
| `recentActivity` | 0.15 |
| `usefulReply` | 0.20 |
| `canParticipate` | 0.15 |

`opportunityScore` = utilidad de intervenir. `evidenceConfidence` = fiabilidad de señales (fechas desconocidas / `allowsReplies` null bajan confianza; no se inventan fechas).

## API

Base: `/api/growth/:workspace/conversations/...`

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/status` | DFS mode, GA4, limitations, config |
| GET | `/runs` | Lista de ejecuciones |
| GET | `/runs/:runId` | Detalle + opportunities + drafts |
| POST | `/from-piece/:pieceId` | Inicia búsqueda (pieza publicada) |
| POST | `/runs/:runId/cancel` | Cancela run en progreso |
| GET | `/opportunities/:id` | Detalle oportunidad |
| PATCH | `/drafts/:draftId` | Editar borrador |
| POST | `/opportunities/:id/approve` | Aprobar borrador (**no publica**) |
| POST | `/opportunities/:id/discard` | Descartar con `reason` |
| POST | `/opportunities/:id/register-published` | Registro manual post-approve |
| POST | `/interventions/:id/metrics/collect` | Recolectar GA4 |
| POST | `/interventions/:id/metrics/manual` | Métrica manual |
| GET | `/insights` | Topic insights para Discovery |
| POST | `/metrics/enqueue-collect` | Encola job de métricas |

## UI

`/[workspace]/growth` → pestaña **Conversaciones** (default) | **Creativos**.

- Banner de estado (sandbox / live / missing, GA4, autoTrigger).
- Select pieza publicada + «Buscar conversaciones».
- Lista de runs (progreso, costo estimado, cancelar).
- Oportunidades: score, evidencia, motivos, campos desconocidos etiquetados.
- Abrir URL original; editar / copiar / aprobar / descartar.
- Registrar publicación solo si `editorialStatus === approved`.
- Nunca mostrar «publicado» al aprobar o copiar.

## Piloto (3 artículos publicados)

1. Confirmar DataForSEO (`sandbox` primero) y 3 piezas con `Publication.url` + `publishedAt`.
2. En Growth → Conversaciones, correr «Buscar conversaciones» por cada artículo.
3. Revisar top oportunidades: fechas desconocidas y `allowsReplies` null deben verse como **desconocido**.
4. Editar borrador → Copiar → pegar **manualmente** en el hilo → Aprobar → Registrar publicación (URL + fecha).
5. Si hay GA4: «Recolectar GA4». Contactos/comerciales: métrica manual.
6. Revisar insights; no esperar cambio automático de prioridades Discovery.

## Limitaciones

- **No** auto-post en foros ni mensajes a terceros.
- **Aprobar ≠ publicar.**
- **No** publica en LinkedIn desde este módulo.
- GA4 opcional; ausencia de sesiones ≠ cero resultados.
- Contactos / pipeline comercial solo manual (sin CRM).
- DataForSEO sandbox ≠ SERP de producción; live consume crédito.
- CreativePerformance collector del Creative Engine sigue pendiente (otro módulo).

## Tests

```bash
npm run test:growth
```

Cubre scoring, filtros, normalize-url, spend limit, attribution y `safe-fetch` SSRF (sin APIs de pago).

## Migración

```bash
# Local / staging — NO activar autoTrigger ni live DFS en piloto sin revisar presupuesto
npx prisma migrate deploy --schema=prisma/schema.prisma
```

Migración: `prisma/migrations/20260910120000_growth_conversations/`.

Cola: tabla `agent_jobs` + tick cada `AGENT_JOBS_TICK_MS` (default 15s).
