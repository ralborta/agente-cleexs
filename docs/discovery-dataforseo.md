# Discovery — agente de demanda (DataForSEO)

Segundo agente de la plataforma. **No escribe contenido**: produce *Opportunity Briefs* que Teo consume.

## Flujo

```
Sitio + seeds
  → Google Ads keywords_for_keywords (volumen)
  → Labs related_keywords (SERP “búsquedas relacionadas”, depth 2)
  → Labs keyword_suggestions (long-tails)
  → filtro overlap semillas → LLM (intent/relevancia)
  → Opportunity Score → KeywordOpportunity + brief → Teo
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
DATAFORSEO_MODE=live
```

- `sandbox` → gratis, estructura real (probar integración; datos basura)
- `live` → saldo real (Ads + Labs)

4. Redeploy API
5. Portal → `/{workspace}/discovery` → **Correr Discovery**

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
  "includeSiteKeywords": false,
  "deepExpand": true,
  "maxCandidates": 80
}
```

`deepExpand: true` (default) dispara Labs related (hasta 8 semillas) + suggestions (hasta 5). Sin eso solo queda Keyword Planner y el pool queda chico.
## Relación con Teo

Teo **no** llama DataForSEO. Ordena oportunidades por `opportunityScore` y escribe.
