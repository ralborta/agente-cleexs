# Growth · Creative Engine (V1)

Módulo de **Growth** que convierte artículos publicados por Teo en piezas visuales LinkedIn con templates de marca.

## Flujo

```
Teo publica → Publication
  → enqueueCreativeFromPublication (fire-and-forget)
  → Creative Planner (LLM JSON o fallback)
  → validate (sin truncar en silencio)
  → HTML/CSS → Playwright PNG (o SVG fallback)
  → Preview en /{workspace}/growth
  → Approve → DistributionPost draft
  → (post-V1) LinkedIn Publisher + performance
```

## Qué no hace V1

- No publica en LinkedIn
- No toca Teo ni Discovery
- No genera tipografía con IA dentro de la imagen
- No Instagram / video / editor visual

## Modelos

`CreativeTemplate`, `CreativeRequest`, `CreativeAsset`, `DistributionPost`, `CreativePerformance`

## API

- `GET /api/growth/:ws/creative/templates`
- `GET /api/growth/:ws/creative/requests`
- `POST /api/growth/:ws/creative/from-piece/:pieceId`
- `POST /api/growth/:ws/creative/requests/:id/approve`
- `POST /api/growth/:ws/creative/requests/:id/reprocess`
- `GET /api/growth/:ws/creative/assets/:assetId`

## BrandKit

`AgentConfig.branding.distribution` del agente `growth` (fallback: branding de Teo).

## Assets

`CREATIVE_ASSETS_DIR` (default `.creative-assets`). Playwright opcional; si no hay Chromium → SVG.

## Seed

- Agent `growth`
- BrandKit Empleados con `distribution`
