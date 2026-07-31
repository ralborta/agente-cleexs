import type { ArticleData, ArticleSection } from './article-template';
import { sanitizeChartSpec } from './charts';
import type { BrandKit } from '@agente/shared';
import type { ResearchResult, StrategistPlan } from './types';

const DEFAULT_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';

function readOpenAiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key || null;
}

export function isLlmWriterEnabled(): boolean {
  return Boolean(readOpenAiKey());
}

const ARTICLE_JSON_SCHEMA = `{
  "kicker": "string — etiqueta corta del tema",
  "lead": "string — párrafo introductorio (2-3 oraciones, tono editorial PRO)",
  "sections": [
    {
      "heading": "string",
      "body": "string — 2-4 párrafos con datos, contexto LATAM/PyME. Usá links markdown [texto](url) hacia fuentes reales.",
      "items": ["opcional — bullets accionables"],
      "faqs": [{"q": "...", "a": "..."}],
      "table": {"headers": ["..."], "rows": [["..."]]},
      "examples": [{"title": "Ejemplo: ...", "body": "caso concreto con números o situación realista"}],
      "callout": "opcional — insight clave o advertencia",
      "chart": {
        "type": "bar | line | pie | doughnut",
        "title": "título corto del gráfico",
        "labels": ["categoría 1", "categoría 2", "..."],
        "datasets": [{"label": "serie", "data": [10, 20, 30]}],
        "sourceNote": "de dónde sale el dato o 'Estimación ilustrativa basada en X' si no es un dato duro"
      }
    }
  ],
  "references": [
    {"title": "Nombre de la fuente", "url": "https://...", "note": "por qué es relevante"}
  ]
}`;

const PIECE_TYPE_BRIEF: Record<string, string> = {
  faq: `- Estructura en 2-3 secciones temáticas (ej. "Preguntas básicas", "Preguntas sobre implementación", "Preguntas avanzadas").
- Mínimo 10 preguntas frecuentes en total (usá el campo "faqs" de cada sección), específicas y variadas — nada de preguntas genéricas tipo "¿qué es X?" repetidas sin sustancia.
- Cada respuesta debe tener 3-5 oraciones con datos concretos, no una línea.`,
  checklist: `- Organizá el contenido en 2-3 checklists temáticos (ej. técnico, contenido, medición) usando el campo "items", con mínimo 12 ítems accionables en total.
- Cada ítem debe ser una acción concreta y verificable, no una idea vaga.
- Sumá al menos 1 tabla ("table") con criterios de priorización (ej. impacto vs esfuerzo).`,
  comparison: `- Incluí al menos 2 tablas comparativas ("table") con mínimo 4 filas y 3 columnas cada una, comparando alternativas reales con criterios claros (costo, tiempo, resultado esperado).
- Después de cada tabla, un párrafo de análisis explicando cuándo conviene cada opción.
- Cerrá con una recomendación clara según el perfil de PyME (chica, mediana, con o sin equipo técnico).`,
  how_to: `- Pasos numerados y secuenciales, cada uno como una sección con heading tipo "Paso N: ...".
- Cada paso debe incluir: qué hacer, con qué herramienta, tiempo estimado y cómo verificar que funcionó (podés usar "items" para sub-tareas).
- Sumá una sección final de troubleshooting con errores comunes al ejecutar los pasos.`,
  pillar: `- Es la pieza pilar del cluster: máxima profundidad. Mínimo 9 secciones sustanciales.
- Incluí al menos 1 tabla comparativa/resumen y 1 checklist de acción.
- Cerrá con un plan de implementación por etapas (ej. 30/60/90 días) con métricas de éxito por etapa.`,
};

function buildWriterPrompt(
  plan: StrategistPlan,
  research: ResearchResult,
  tone?: string | null,
  branding?: BrandKit,
): string {
  const brandName = branding?.brandName?.trim() || 'Cleexs';
  const ctaHint = branding?.cta?.url
    ? `CTA natural hacia ${branding.cta.url} (sin ser spam).`
    : `CTA natural hacia la propuesta de valor de ${brandName} (sin ser spam).`;
  const isPillar = plan.pieceType === 'pillar';
  const minSections = isPillar ? 9 : 6;
  const minWords = isPillar ? 2600 : 1800;
  const typeBrief = PIECE_TYPE_BRIEF[plan.pieceType] || PIECE_TYPE_BRIEF.pillar;

  const sourcesBlock = research.sources.length
    ? `\nFuentes/investigación disponible para basar el contenido (usalas como respaldo real, no las ignores):\n${research.sources.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n`
    : '';

  return `Sos Teo, redactor senior SEO/AEO para ${brandName} (visibilidad en Google e IA para PyMEs latinoamericanas).

Escribí un artículo PRO en español rioplatense, profundo, denso en información real y accionable. Nada de relleno ni frases genéricas de blog corporativo.

Título: ${plan.title}
Tema: ${plan.topic}
Tipo de pieza: ${plan.pieceType}
Keyword principal: ${plan.keyword}
Marca / cliente: ${brandName}
Tono: ${tone || 'profesional, claro, sin hype vacío'}
Objetivo: ${plan.objective}

Outline sugerido (podés reordenar/expandir si mejora el artículo):
${research.outline.map((o, i) => `${i + 1}. ${o}`).join('\n')}
${sourcesBlock}
Requisitos de estructura para este tipo de pieza (${plan.pieceType}):
${typeBrief}

Requisitos obligatorios de profundidad:
- Mínimo ${minSections} secciones sustanciales (no relleno), con ${minWords}+ palabras en total entre lead y secciones.
- Cada sección de tipo "body" debe tener 3-5 párrafos (no 1-2), con datos, cifras o contexto verificable, no solo afirmaciones vagas.
- Incluí al menos 3 bloques "examples" con casos concretos y distintos de PyMEs latinoamericanas (retail, servicios, B2B, industria) — con números o situaciones específicas, no genéricas.
- Incluí al menos 2 "callout" con insights accionables o datos que llamen la atención.
- En el cuerpo, usá enlaces markdown [texto](url) a fuentes autorizadas. Si te di fuentes reales arriba, priorizá citarlas. Si no, solo dominios creíbles (.google.com, .org, medios tech serios) — no inventes URLs.
- Sección final de "references": 6-8 fuentes con URL https válida (usá las fuentes reales si te las di).
- Mencioná AEO, AI Overviews y visibilidad en asistentes (ChatGPT, Gemini, Claude) cuando aplique naturalmente.
- Incluí 1-2 gráficos ("chart") en las secciones donde haya algo cuantificable para visualizar (comparativas, evolución en el tiempo, distribución de esfuerzo/impacto, resultados típicos). Si el dato no viene de una fuente dura, marcalo igual con "sourceNote": "Estimación ilustrativa" — nunca presentes un número inventado como si fuera un dato oficial. Si no hay nada sensato para graficar en una pieza, no fuerces un chart.
- ${ctaHint}
- NO uses emojis. NO digas "como modelo de lenguaje". NO repitas la misma idea con otras palabras para rellenar.

Respondé SOLO con JSON válido (sin markdown fence) con esta forma:
${ARTICLE_JSON_SCHEMA}`;
}

function parseArticleJson(raw: string, branding?: BrandKit): ArticleData {
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
  const parsed = JSON.parse(trimmed) as Partial<ArticleData>;
  if (!parsed.lead || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error('JSON de artículo incompleto');
  }
  const sections: ArticleSection[] = parsed.sections.map((section) => ({
    ...section,
    chart: section.chart ? (sanitizeChartSpec(section.chart) ?? undefined) : undefined,
  }));
  return {
    kicker: parsed.kicker?.trim() || `${branding?.brandName ?? 'Cleexs'} Insights`,
    title: '',
    lead: parsed.lead.trim(),
    sections,
    pieceType: '',
    references: parsed.references?.filter((r) => r?.title && r?.url) ?? [],
  };
}

export async function generateArticleWithLlm(
  plan: StrategistPlan,
  research: ResearchResult,
  tone?: string | null,
  branding?: BrandKit,
): Promise<ArticleData> {
  const apiKey = readOpenAiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no configurada');
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.65,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Sos un editor SEO/AEO experto. Respondés únicamente JSON válido según el esquema pedido, con contenido denso y profundo, sin relleno.',
        },
        { role: 'user', content: buildWriterPrompt(plan, research, tone, branding) },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI sin contenido');

  const article = parseArticleJson(content, branding);
  return {
    ...article,
    title: plan.title,
    pieceType: plan.pieceType,
    kicker: article.kicker || plan.topic,
  };
}
