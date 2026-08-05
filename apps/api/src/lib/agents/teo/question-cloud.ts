/**
 * Sprint 1.3 — preguntas reales estilo AnswerThePublic por cluster.
 * LLM si hay OPENAI_API_KEY; si no, plantillas determinísticas.
 */

import type { FunnelStageCode } from './keyword-cloud';

export type GeneratedQuestion = {
  question: string;
  cluster: string;
  stage: FunnelStageCode;
  intent: string;
  intentLabel: string;
  businessFit: number;
  priority: number;
};

function normalizeQuestion(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function cleanQuestion(value: string): string {
  let q = value.replace(/\s+/g, ' ').trim();
  if (!q) return q;
  if (!/[¿?]/.test(q) && /^(qué|que|cómo|como|cuánto|cuanto|por qué|por que|dónde|donde|quién|quien|cuál|cual|vale|sirve|funciona)/i.test(q)) {
    q = `¿${q.replace(/^\¿/, '')}`;
  }
  if (q.startsWith('¿') && !q.endsWith('?')) q = `${q}?`;
  return q.charAt(0).toUpperCase() === '¿' || q.startsWith('¿')
    ? q
    : q.charAt(0).toUpperCase() + q.slice(1);
}

function topicFromCluster(cluster: string): string {
  return cluster
    .replace(/^cluster:\s*/i, '')
    .replace(/^demanda gsc$/i, 'Cleexs')
    .trim() || cluster;
}

/** Fallback sin LLM. */
export function generateQuestionsWithRules(cluster: string, seedHints: string[] = []): GeneratedQuestion[] {
  const topic = topicFromCluster(cluster);
  const lower = topic.toLowerCase();
  const hint = (seedHints[0] ?? topic).toLowerCase();

  const templates: Array<{
    pattern: string;
    stage: FunnelStageCode;
    intent: string;
    intentLabel: string;
    businessFit: number;
    priority: number;
  }> = [
    { pattern: `¿Qué es ${lower}?`, stage: 'tofu', intent: 'informational', intentLabel: 'Definición', businessFit: 40, priority: 45 },
    { pattern: `¿Cómo funciona ${lower}?`, stage: 'tofu', intent: 'informational', intentLabel: 'Mecanismo', businessFit: 45, priority: 48 },
    { pattern: `¿Para qué sirve ${lower}?`, stage: 'tofu', intent: 'informational', intentLabel: 'Beneficio', businessFit: 50, priority: 50 },
    { pattern: `¿Cómo mejorar ${lower} en una pyme?`, stage: 'mofu', intent: 'commercial', intentLabel: 'Mejora práctica', businessFit: 70, priority: 65 },
    { pattern: `¿Cuáles son los errores comunes con ${lower}?`, stage: 'mofu', intent: 'commercial', intentLabel: 'Evitar fricción', businessFit: 65, priority: 60 },
    { pattern: `¿${hint} vs alternativas?`, stage: 'mofu', intent: 'commercial', intentLabel: 'Comparar', businessFit: 75, priority: 70 },
    { pattern: `¿Cuánto cuesta ${lower}?`, stage: 'bofu', intent: 'transactional', intentLabel: 'Precio', businessFit: 85, priority: 80 },
    { pattern: `¿Vale la pena contratar ${lower}?`, stage: 'bofu', intent: 'transactional', intentLabel: 'Decisión de compra', businessFit: 90, priority: 85 },
    { pattern: `¿Cómo elegir una agencia de ${lower}?`, stage: 'bofu', intent: 'transactional', intentLabel: 'Vendor selection', businessFit: 88, priority: 82 },
    { pattern: `¿${lower} funciona para empresas en Argentina / LATAM?`, stage: 'bofu', intent: 'transactional', intentLabel: 'Fit local', businessFit: 80, priority: 78 },
  ];

  const seen = new Set<string>();
  const out: GeneratedQuestion[] = [];
  for (const t of templates) {
    const q = cleanQuestion(t.pattern);
    const key = normalizeQuestion(q);
    if (!q || seen.has(key)) continue;
    seen.add(key);
    out.push({
      question: q,
      cluster,
      stage: t.stage,
      intent: t.intent,
      intentLabel: t.intentLabel,
      businessFit: t.businessFit,
      priority: t.priority,
    });
  }
  return out;
}

type LlmItem = {
  question?: string;
  stage?: string;
  intent?: string;
  intentLabel?: string;
  businessFit?: number;
  priority?: number;
};

async function generateQuestionsWithLlm(
  cluster: string,
  seedHints: string[],
): Promise<GeneratedQuestion[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const topic = topicFromCluster(cluster);
  const hints = seedHints.slice(0, 8).join(', ') || topic;

  const prompt = `Sos un estratega SEO/AEO. Generá preguntas REALES que la gente escribe en Google / ChatGPT (estilo AnswerThePublic).

Cluster: "${cluster}"
Tema: "${topic}"
Keywords de contexto: ${hints}

Respondé SOLO JSON válido:
{
  "items": [
    {
      "question": "¿…?",
      "stage": "tofu|mofu|bofu",
      "intent": "informational|commercial|transactional",
      "intentLabel": "etiqueta corta en español",
      "businessFit": 0-100,
      "priority": 0-100
    }
  ]
}

Reglas:
- Exactamente 10 preguntas en español (LATAM), con signos ¿?
- Mezclá preposiciones: qué, cómo, cuánto, por qué, vale la pena, vs, errores, checklist.
- 3–4 TOFU, 3–4 MOFU, 2–3 BOFU.
- businessFit alto = más cerca de contratar / comprar / pedir demo.
- Nada genérico vacío; deben sonar a búsqueda real.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Respondés únicamente JSON válido según el esquema pedido.' },
          { role: 'user', content: prompt },
        ],
        ...(/^(gpt-5|o[0-9])/i.test(model)
          ? { max_completion_tokens: 3000 }
          : { max_tokens: 2500, temperature: 0.55 }),
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      console.warn('[question-cloud] LLM error', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { items?: LlmItem[] };
    if (!Array.isArray(parsed.items) || !parsed.items.length) return null;

    const seen = new Set<string>();
    const out: GeneratedQuestion[] = [];
    for (const item of parsed.items) {
      const question = cleanQuestion(String(item.question ?? ''));
      const key = normalizeQuestion(question);
      if (!question || question.length < 8 || seen.has(key)) continue;
      seen.add(key);
      const stageRaw = String(item.stage ?? 'tofu').toLowerCase();
      const stage: FunnelStageCode =
        stageRaw === 'bofu' || stageRaw === 'mofu' || stageRaw === 'tofu' ? stageRaw : 'tofu';
      const businessFit = Math.max(0, Math.min(100, Number(item.businessFit) || 50));
      const priority = Math.max(0, Math.min(100, Number(item.priority) || businessFit));
      out.push({
        question,
        cluster,
        stage,
        intent: String(item.intent ?? 'informational'),
        intentLabel: String(item.intentLabel ?? 'Pregunta real'),
        businessFit,
        priority,
      });
    }
    return out.length ? out : null;
  } catch (err) {
    console.warn('[question-cloud] LLM falló:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function expandClusterQuestions(
  cluster: string,
  seedHints: string[] = [],
): Promise<{ items: GeneratedQuestion[]; source: 'llm' | 'rules' }> {
  const llm = await generateQuestionsWithLlm(cluster, seedHints);
  if (llm?.length) return { items: llm, source: 'llm' };
  return { items: generateQuestionsWithRules(cluster, seedHints), source: 'rules' };
}
