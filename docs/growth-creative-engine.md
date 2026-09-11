# Agente Growth

Growth **distribuye fuera del sitio** el contenido que Teo publica, y mide adquisición.

```
Discovery → oportunidades
Teo       → crea / publica en el sitio
Growth    → distribuye + mide (fuera del sitio)
```

## Módulos

| Módulo | Rol | Estado |
|--------|-----|--------|
| **Conversaciones** | SERP → oportunidades → borradores; publicación manual | **V1 activo** — ver [growth-conversations.md](./growth-conversations.md) |
| **Creative Engine** | Templates de marca → PNG (copy corto, no IA en imagen) | **V1 activo** |
| **Publisher** | Publicar assets en canales | **LinkedIn V1** (perfil personal) |
| **Performance** | CTR / engagement por template y canal | Modelo listo, collector pendiente |
| **Multi-canal** | LinkedIn primero; luego email, X, etc. | Arquitectura lista (`DistributionChannel`) |

## Creative Engine (V1)

Canal inicial: **LinkedIn** (square / landscape). No es “todo Growth”.

Flujo:

```
Teo publica → Publication
  → Creative Planner
  → Render HTML/CSS → PNG
  → Preview en /growth
  → Approve → DistributionPost draft
  → Publisher LinkedIn (manual) → ugcPost
  → (luego) Performance
```

Docs detalle: este archivo + código en `apps/api/src/lib/agents/growth/`.

## LinkedIn Publisher (V1)

Publica el `DistributionPost` draft en el **perfil personal** del miembro conectado (`w_member_social` / producto Share on LinkedIn).

Limitaciones V1:

- No publica en **Company Page** (requiere Community Management API / producto Organization).
- No hay auto-publish al aprobar: el botón **Publicar en LinkedIn** es explícito.
- Token OAuth por workspace; status API nunca expone el access token en claro.
- Caption: `DistributionPost.caption` o headline/cta del planner.

API:

- `GET /api/growth/:ws/linkedin/status`
- `POST /api/growth/:ws/linkedin/connect` → `{ authorizeUrl }`
- `GET /api/integrations/linkedin/callback` (público)
- `POST /api/growth/:ws/creative/requests/:id/publish-linkedin`
- También: `POST /api/integrations/:ws/linkedin/publish/:requestId`

Env: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI`, `LINKEDIN_API_VERSION` (default `202509`).

## API Creative

- `GET /api/growth/:ws/creative/templates`
- `GET /api/growth/:ws/creative/requests`
- `POST /api/growth/:ws/creative/from-piece/:pieceId`
- `POST /api/growth/:ws/creative/requests/:id/approve`
- `POST /api/growth/:ws/creative/requests/:id/publish-linkedin`
- `GET /api/growth/:ws/creative/assets/:assetId`

## BrandKit

`AgentConfig` del agente `growth` → `branding.distribution`.
