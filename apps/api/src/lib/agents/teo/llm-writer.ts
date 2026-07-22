import type { ArticleData } from './article-template';
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
      "callout": "opcional — insight clave o advertencia"
    }
  ],
  "references": [
    {"title": "Nombre de la fuente", "url": "https://...", "note": "por qué es relevante"}
  ]
}`;

function buildWriterPrompt(plan: StrategistPlan, research: ResearchResult, tone?: string | null): string {
  return `Sos Teo, redactor senior SEO/AEO de Cleexs (visibilidad en Google e IA para PyMEs latinoamericanas).

Escribí un artículo PRO en español rioplatense, profundo y accionable.

Título: ${plan.title}
Tema: ${plan.topic}
Tipo de pieza: ${plan.pieceType}
Keyword principal: ${plan.keyword}
Tono: ${tone || 'profesional, claro, sin hype vacío'}
Objetivo: ${plan.objective}

Outline sugerido:
${research.outline.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Requisitos obligatorios:
- Mínimo 6 secciones sustanciales (no relleno).
- Incluí al menos 2 bloques "examples" con casos concretos de PyMEs (retail, servicios, B2B).
- Incluí al menos 1 "callout" con un insight accionable.
- En el cuerpo, usá enlaces markdown [texto](url) a fuentes autorizadas (Google Search Central, documentación oficial, estudios reconocidos). No inventes URLs: solo dominios creíbles (.google.com, .org, medios tech serios).
- Sección final de "references": 4-6 fuentes reales con URL https válida.
- Mencioná AEO, AI Overviews y visibilidad en asistentes (ChatGPT, Gemini) cuando aplique.
- CTA natural hacia diagnóstico Cleexs (sin ser spam).
- NO uses emojis. NO digas "como modelo de lenguaje".

Respondé SOLO con JSON válido (sin markdown fence) con esta forma:
${ARTICLE_JSON_SCHEMA}`;
}

function parseArticleJson(raw: string): ArticleData {
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
  const parsed = JSON.parse(trimmed) as Partial<ArticleData>;
  if (!parsed.lead || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error('JSON de artículo incompleto');
  }
  return {
    kicker: parsed.kicker?.trim() || 'Cleexs Insights',
    title: '',
    lead: parsed.lead.trim(),
    sections: parsed.sections,
    pieceType: '',
    references: parsed.references?.filter((r) => r?.title && r?.url) ?? [],
  };
}

export async function generateArticleWithLlm(
  plan: StrategistPlan,
  research: ResearchResult,
  tone?: string | null,
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
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Sos un editor SEO/AEO experto. Respondés únicamente JSON válido según el esquema pedido.',
        },
        { role: 'user', content: buildWriterPrompt(plan, research, tone) },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
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

  const article = parseArticleJson(content);
  return {
    ...article,
    title: plan.title,
    pieceType: plan.pieceType,
    kicker: article.kicker || plan.topic,
  };
}
