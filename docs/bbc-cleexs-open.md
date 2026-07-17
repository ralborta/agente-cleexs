# Cleexs WhatsApp — BBC Cloud → BBC Open (Baileys)

Copia exacta del agente conversacional desde BuilderBot Cloud (**Cleexs**) al canal self-hosted (patrón Andreu).

## Proyectos BBC

| Proyecto | UUID | Rol |
|----------|------|-----|
| **Cleexs** (original) | `05d56bc9-3d4b-488d-8e11-8fed0c466055` | Fuente |
| **Cleexs Open** (copia MCP) | `265d386d-6681-41cc-9423-49b8d7c5a3e6` | Espejo Cloud del mismo prompt/flows |
| Baileys EasyPanel `wa-bot` | — | Transporte BBC Open Source (como Andreu `bot/`) |

## Flows (idénticos al Cleexs original)

1. **Cleexs — Entrada QR** (`EVENTS.WELCOME`) → `add_intent` (URL vs consultas)
2. **Cleexs — URL diagnóstico** → `add_http` → Cleexs Railway webhook
3. **Cleexs — Consultas IA** → `add_chatpdf` + prompt oficial (`gpt-4o-mini`)
4. **Cleexs - Saludo** → texto fijo BBC

## Cómo Andreu / Cleexs Open (Baileys)

```
Usuario WhatsApp
    ↓
bot/ Baileys (BBC Open) — solo transporta
    ↓ POST /api/webhooks/builderbot
API Agente Cleexs
    ├── URL        → Cleexs /diagnostic/whatsapp/url
    ├── saludo     → texto BBC Saludo
    └── resto      → Cleexs /whatsapp/assistant  (mismo prompt Consultas IA)
    ↓ { message }
bot/ envía al chat
```

En Andreu Cloud la IA vive en BBC; con Baileys la IA vive en la API (mismo contrato webhook).

## Prompt

El system prompt de Consultas IA está en:

- BBC Cleexs / Cleexs Open (`assistantInstructions`)
- Cleexs API: `BUILDERBOT_FAQ_ASSISTANT_PROMPT` en `apps/api/src/lib/whatsapp-channel.ts`
