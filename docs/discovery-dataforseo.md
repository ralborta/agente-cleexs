# Discovery — agente de demanda (DataForSEO)

Segundo agente de la plataforma. **No escribe contenido**: produce *Opportunity Briefs* que Teo consume.

## Flujo

```
Sitio + seeds
  → Google Ads keywords_for_keywords (volumen)
  → Labs related_keywords (SERP “búsquedas relacionadas”, depth 2)
  → Labs keyword_suggestions (long-tails)
  → filtro overlap semillas → LLM (intent/relevancia)
  → Opportunity Score
  → YouTube (opcional, top N):
       · SERP youtube/organic/live/advanced
       · Trends explore live type=youtube (graph + queries)
  → KeywordOpportunity.brief (sources.google + sources.youtube) → Teo
```

Score MVP (Google/LLM; YouTube es señal lateral en el brief):

`Demanda×0.35 + Tendencia×0.25 + Relevancia×0.40`

Presence: `channels: ["google"] | ["google","youtube"]` según datos YT.

## Setup

1. Creá cuenta en [DataForSEO](https://app.dataforseo.com)
2. API Access → copiá login / password
3. En Easypanel API:

```
DATAFORSEO_LOGIN=...
DATAFORSEO_PASSWORD=...
DATAFORSEO_MODE=live
```

- `sandbox` → gratis, estructura real (probar integración; datos basura)
- `live` → saldo real (Ads + Labs + YouTube SERP + Trends)

4. Redeploy API
5. Portal → `/{workspace}/discovery` → **Correr Discovery**

## Endpoints DataForSEO usados

| Path | Rol |
|------|-----|
| `/v3/keywords_data/google_ads/keywords_for_keywords/live` | Volumen / ideas Google |
| `/v3/dataforseo_labs/google/related_keywords/live` | Related SERP Google |
| `/v3/dataforseo_labs/google/keyword_suggestions/live` | Long-tails |
| `/v3/serp/youtube/organic/live/advanced` | Videos/canales posicionados en YT |
| `/v3/keywords_data/google_trends/explore/live` (`type: youtube`) | Interés + related queries YT |

## API plataforma

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
  "includeYoutube": true,
  "youtubeMaxKeywords": 10,
  "maxCandidates": 80
}
```

`includeYoutube: true` (default) enriquece hasta `youtubeMaxKeywords` briefs con SERP + Trends YouTube. No genera ni publica videos.

## Relación con Teo

Teo **no** llama DataForSEO. Ordena oportunidades por `opportunityScore` y escribe.
