# Discovery — agente de demanda (DataForSEO)

Segundo agente de la plataforma. **No escribe contenido**: produce *Opportunity Briefs* que Teo consume.

## Flujo

```
Sitio + seeds → DataForSEO (ideas + volumen + monthly) → LLM (intent/relevancia/ángulo)
  → Opportunity Score → KeywordOpportunity + brief JSON → Teo elige por score
```

Score MVP:

`Demanda×0.35 + Tendencia×0.25 + Relevancia×0.40`

## Setup (opción A — capa gratis)

1. Creá cuenta en [DataForSEO](https://app.dataforseo.com)
2. API Access → copiá login / password
3. En Easypanel API:

```
DATAFORSEO_LOGIN=...
DATAFORSEO_PASSWORD=...
DATAFORSEO_MODE=sandbox
```

- `sandbox` → gratis, estructura real (probar integración)
- `live` → consume el US$1 de trial / saldo (datos reales de Ads)

4. Redeploy API
5. Portal → Oportunidades → **Explorar mercado**

## Endpoints

- `GET /api/discovery/:workspace/status`
- `POST /api/discovery/:workspace/explore`

Body ejemplo:

```json
{
  "siteUrl": "https://empliados.net",
  "description": "Plataforma de marca empleadora",
  "market": "ar",
  "seeds": ["marca empleadora", "atracción de talento"],
  "includeSiteKeywords": true,
  "maxCandidates": 40
}
```

## Relación con Teo

Teo **no** llama DataForSEO. Ordena oportunidades por `opportunityScore` y escribe.
