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
| **Creative Engine** | Templates de marca → PNG (copy corto, no IA en imagen) | **V1 activo** |
| **Publisher** | Publicar assets en canales | Pendiente |
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
  → (luego) Publisher + Performance
```

Docs detalle: este archivo + código en `apps/api/src/lib/agents/growth/`.

## API Creative

- `GET /api/growth/:ws/creative/templates`
- `GET /api/growth/:ws/creative/requests`
- `POST /api/growth/:ws/creative/from-piece/:pieceId`
- `POST /api/growth/:ws/creative/requests/:id/approve`
- `GET /api/growth/:ws/creative/assets/:assetId`

## BrandKit

`AgentConfig` del agente `growth` → `branding.distribution`.
