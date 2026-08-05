/**
 * Genera un cloud de keywords por seed, etiquetado TOFU/MOFU/BOFU.
 * Usa LLM si hay OPENAI_API_KEY; si no, reglas determinísticas.
 */

export type FunnelStageCode = 'tofu' | 'mofu' | 'bofu';

export type GeneratedKeyword = {
  keyword: string;
  cluster: string;
  stage: FunnelStageCode;
  intent: string;
  intentLabel: string;
  priority: number;
};

const STAGE_LABEL: Record<FunnelStageCode, string> = {
  tofu: 'Top of funnel — descubrimiento',
  mofu: 'Middle of funnel — evaluación',
  bofu: 'Bottom of funnel — decisión',
};

function normalizeKeyword(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function titleCaseKeyword(value: string): string {
  const raw = value.replace(/\s+/g, ' ').trim();
  if (!raw) return raw;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Expansión sin LLM: siempre disponible como fallback. */
export function expandSeedWithRules(seed: string): GeneratedKeyword[] {
  const s = seed.replace(/\s+/g, ' ').trim();
  if (!s) return [];
  const cluster = `Cluster: ${s}`;
  const lower = s.toLowerCase();

  const templates: Array<{ pattern: string; stage: FunnelStageCode; intent: string; intentLabel: string; priority: number }> = [
    { pattern: `qué es ${lower}`, stage: 'tofu', intent: 'informational', intentLabel: 'Aprender el concepto', priority: 40 },
    { pattern: `cómo funciona ${lower}`, stage: 'tofu', intent: 'informational', intentLabel: 'Entender el mecanismo', priority: 35 },
    { pattern: `guía ${lower} para pymes`, stage: 'tofu', intent: 'informational', intentLabel: 'Guía introductoria', priority: 45 },
    { pattern: `beneficios de ${lower}`, stage: 'tofu', intent: 'informational', intentLabel: 'Motivación / valor', priority: 30 },
    { pattern: `errores comunes al ${lower}`, stage: 'mofu', intent: 'commercial', intentLabel: 'Evitar fricción', priority: 55 },
    { pattern: `cómo mejorar ${lower}`, stage: 'mofu', intent: 'commercial', intentLabel: 'Mejora práctica', priority: 60 },
    { pattern: `checklist ${lower}`, stage: 'mofu', intent: 'commercial', intentLabel: 'Plan de acción', priority: 58 },
    { pattern: `${lower} vs alternativas`, stage: 'mofu', intent: 'commercial', intentLabel: 'Comparar opciones', priority: 65 },
    { pattern: `mejores herramientas para ${lower}`, stage: 'mofu', intent: 'commercial', intentLabel: 'Shortlist de tools', priority: 62 },
    { pattern: `alternativas a líderes en ${lower}`, stage: 'bofu', intent: 'transactional', intentLabel: 'Buscar alternativa', priority: 75 },
    { pattern: `${lower} precios`, stage: 'bofu', intent: 'transactional', intentLabel: 'Evaluar costo', priority: 80 },
    { pattern: `cómo conseguir clientes con ${lower}`, stage: 'bofu', intent: 'transactional', intentLabel: 'Resultado de negocio', priority: 85 },
    { pattern: `${lower} para pymes argentina`, stage: 'bofu', intent: 'transactional', intentLabel: 'Decisión local', priority: 78 },
    { pattern: `contratar agencia ${lower}`, stage: 'bofu', intent: 'transactional', intentLabel: 'Compra / servicio', priority: 82 },
  ];

  const seen = new Set<string>();
  const out: GeneratedKeyword[] = [];

  // La seed misma como oportunidad MOFU/BOFU según wording
  const seedStage: FunnelStageCode = /alternativa|precio|contratar|clientes|vs\b/i.test(lower)
    ? 'bofu'
    : /cómo|checklist|mejorar|error/i.test(lower)
      ? 'mofu'
      : 'tofu';
  const seedKey = normalizeKeyword(s);
  seen.add(seedKey);
  out.push({
    keyword: titleCaseKeyword(s),
    cluster,
    stage: seedStage,
    intent: seedStage === 'bofu' ? 'transactional' : seedStage === 'mofu' ? 'commercial' : 'informational',
    intentLabel: STAGE_LABEL[seedStage],
    priority: 90,
  });

  for (const t of templates) {
    const kw = normalizeKeyword(t.pattern);
    if (seen.has(kw) || kw === seedKey) continue;
    seen.add(kw);
    out.push({
      keyword: titleCaseKeyword(t.pattern),
      cluster,
      stage: t.stage,
      intent: t.intent,
      intentLabel: t.intentLabel,
      priority: t.priority,
    });
  }

  return out;
}

type LlmItem = {
  keyword?: string;
  cluster?: string;
  stage?: string;
  intent?: string;
  intentLabel?: string;
  priority?: number;
};

async function expandSeedWithLlm(seed: string): Promise<GeneratedKeyword[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const prompt = `Sos un estratega SEO/AEO para PyMEs LATAM.
Dada la keyword semilla: "${seed}"

Generá un cloud de keywords que la gente YA busca, cubriendo el buyer journey.
Incluí: long-tail, alternativas a líderes, "cheaper options than", comparativas, pricing, how-tos.

Respondé SOLO JSON válido:
{
  "items": [
    {
      "keyword": "string",
      "cluster": "nombre corto del cluster temático",
      "stage": "tofu|mofu|bofu",
      "intent": "informational|commercial|transactional",
      "intentLabel": "intención en español, corta",
      "priority": 0-100
    }
  ]
}

Reglas:
- Exactamente 5 keywords TOFU, 5 MOFU y 5 BOFU (15 en total).
- Incluí la semilla (o una variante muy cercana) una sola vez.
- Keywords en español (salvo marcas propias en inglés).
- Nada inventado como marca falsa; usá patrones reales ("X alternatives", "X vs Y", "X pricing").
- priority alto = más chance de negocio si posicionamos.`;

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
        ...( /^(gpt-5|o[0-9])/i.test(model)
          ? { max_completion_tokens: 4000 }
          : { max_tokens: 3000, temperature: 0.5 }),
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      console.warn('[keyword-cloud] LLM error', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { items?: LlmItem[] };
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;

    const seen = new Set<string>();
    const out: GeneratedKeyword[] = [];
    for (const item of parsed.items) {
      const keyword = titleCaseKeyword(String(item.keyword ?? ''));
      const key = normalizeKeyword(keyword);
      if (!keyword || seen.has(key)) continue;
      const stageRaw = String(item.stage ?? 'mofu').toLowerCase();
      const stage: FunnelStageCode =
        stageRaw === 'tofu' || stageRaw === 'bofu' ? stageRaw : 'mofu';
      seen.add(key);
      out.push({
        keyword,
        cluster: String(item.cluster ?? `Cluster: ${seed}`).trim() || `Cluster: ${seed}`,
        stage,
        intent: String(item.intent ?? 'commercial'),
        intentLabel: String(item.intentLabel ?? STAGE_LABEL[stage]),
        priority: Math.max(0, Math.min(100, Number(item.priority) || 50)),
      });
    }
    return out.length ? out : null;
  } catch (err) {
    console.warn('[keyword-cloud] LLM falló:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function expandSeedKeyword(seed: string): Promise<{
  items: GeneratedKeyword[];
  source: 'llm' | 'rules';
}> {
  const llm = await expandSeedWithLlm(seed);
  if (llm?.length) return { items: llm, source: 'llm' };
  return { items: expandSeedWithRules(seed), source: 'rules' };
}

export { STAGE_LABEL, normalizeKeyword };
