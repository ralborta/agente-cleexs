import type { CreativeContentInput, CreativePlan, CreativeTemplateConfig } from './types';
import {
  CREATIVE_TEMPLATE_CATALOG,
  DEFAULT_FALLBACK_TEMPLATE_KEY,
  getTemplateConfig,
} from './templates/registry';
import { validateCreativePlan } from './validate';

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function pickTemplateForContent(input: CreativeContentInput): CreativeTemplateConfig {
  const title = input.title.toLowerCase();
  if (/\d+\s/.test(title) || /tareas|pasos|checklist|lista/.test(title)) {
    return (
      getTemplateConfig(input.keyPoints.length >= 5 ? 'list_5_01' : 'list_3_01') ||
      CREATIVE_TEMPLATE_CATALOG[0]!
    );
  }
  if (/\?|cómo|como |por qué|porque/.test(title)) {
    return getTemplateConfig('question_01') || CREATIVE_TEMPLATE_CATALOG[0]!;
  }
  if (/vs|versus|compar/.test(title)) {
    return getTemplateConfig('comparison_01') || CREATIVE_TEMPLATE_CATALOG[0]!;
  }
  if (/mito|hecho|myth/.test(title)) {
    return getTemplateConfig('myth_fact_01') || CREATIVE_TEMPLATE_CATALOG[0]!;
  }
  if (/%|\d+%|dato|estad/.test(title)) {
    return getTemplateConfig('statistic_01') || CREATIVE_TEMPLATE_CATALOG[0]!;
  }
  return getTemplateConfig(DEFAULT_FALLBACK_TEMPLATE_KEY) || CREATIVE_TEMPLATE_CATALOG[0]!;
}

export function deterministicPlan(input: CreativeContentInput): CreativePlan {
  const template = pickTemplateForContent(input);
  const points = input.keyPoints.length
    ? input.keyPoints
    : input.summary
        .split(/[.•\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 8)
        .slice(0, template.maxBodyLines);

  const plan: CreativePlan = {
    templateKey: template.templateKey,
    templateVersion: template.version,
    intention: template.category,
    headline: clip(input.title, template.maxHeadlineLength),
    subheadline: clip(input.mainInsight || input.summary, template.maxSubheadlineLength),
    bodyLines: points.slice(0, template.maxBodyLines).map((p) => clip(p, template.maxBodyLineLength)),
    cta: clip(input.cta || 'Leer artículo', template.maxCtaLength),
    visualType: 'typographic',
    format: template.defaultFormat,
  };

  if (template.category === 'problem_solution') {
    plan.leftLabel = clip(input.summary || 'El problema', template.maxSubheadlineLength);
    plan.rightLabel = clip(input.mainInsight || 'La solución', template.maxSubheadlineLength);
  }
  if (template.category === 'before_after') {
    plan.leftLabel = 'Antes';
    plan.rightLabel = clip(input.mainInsight || 'Después', template.maxSubheadlineLength);
  }
  if (template.category === 'comparison' || template.category === 'myth_fact') {
    plan.leftLabel = clip(points[0] || 'Opción A', template.maxSubheadlineLength);
    plan.rightLabel = clip(points[1] || 'Opción B', template.maxSubheadlineLength);
  }
  if (template.category === 'quote') {
    plan.quote = clip(input.mainInsight || input.title, template.maxHeadlineLength + 20);
  }
  if (template.category === 'statistic' || template.category === 'data_point') {
    const m = input.title.match(/(\d+[\d.,]%?)/);
    plan.statValue = m?.[1] || String(points.length || 5);
    plan.statLabel = clip(input.mainInsight || 'dato clave', template.maxSubheadlineLength);
  }

  return plan;
}

async function callOpenAiPlan(
  input: CreativeContentInput,
  attempt: number,
): Promise<CreativePlan | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const catalog = CREATIVE_TEMPLATE_CATALOG.map((t) => ({
    templateKey: t.templateKey,
    category: t.category,
    maxHeadlineLength: t.maxHeadlineLength,
    maxSubheadlineLength: t.maxSubheadlineLength,
    maxCtaLength: t.maxCtaLength,
    maxBodyLines: t.maxBodyLines,
    fields: t.fields,
  }));

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const prompt = `Sos el Creative Planner de Growth. Elegí UN template y generá copy corto para LinkedIn.
No inventes datos numéricos falsos. Una sola idea principal. CTA corto.
Intento #${attempt}. Si reintentás, ACORTÁ los textos.

Templates disponibles:
${JSON.stringify(catalog)}

Contenido:
${JSON.stringify(input)}

Respondé SOLO JSON:
{
  "templateKey": "...",
  "headline": "...",
  "subheadline": "...",
  "bodyLines": ["..."],
  "cta": "...",
  "leftLabel": "...",
  "rightLabel": "...",
  "quote": "...",
  "statValue": "...",
  "statLabel": "...",
  "visualType": "typographic",
  "format": "linkedin_square"
}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: attempt > 1 ? 0.2 : 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Devolvés solo JSON válido para Creative Engine.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return null;

  const parsed = JSON.parse(raw) as Partial<CreativePlan> & { templateKey?: string };
  const template =
    getTemplateConfig(parsed.templateKey || '') ||
    getTemplateConfig(DEFAULT_FALLBACK_TEMPLATE_KEY)!;

  return {
    templateKey: template.templateKey,
    templateVersion: template.version,
    intention: template.category,
    headline: String(parsed.headline || input.title),
    subheadline: parsed.subheadline ? String(parsed.subheadline) : undefined,
    bodyLines: Array.isArray(parsed.bodyLines)
      ? parsed.bodyLines.map((x) => String(x))
      : undefined,
    cta: String(parsed.cta || input.cta || 'Leer artículo'),
    leftLabel: parsed.leftLabel ? String(parsed.leftLabel) : undefined,
    rightLabel: parsed.rightLabel ? String(parsed.rightLabel) : undefined,
    quote: parsed.quote ? String(parsed.quote) : undefined,
    statValue: parsed.statValue ? String(parsed.statValue) : undefined,
    statLabel: parsed.statLabel ? String(parsed.statLabel) : undefined,
    visualType: 'typographic',
    format: parsed.format === 'linkedin_landscape' ? 'linkedin_landscape' : template.defaultFormat,
  };
}

/**
 * Planner: LLM JSON → validación → regenerate (sin truncar en silencio).
 * Fallback determinístico si no hay LLM.
 */
export async function planCreative(input: CreativeContentInput): Promise<{
  plan: CreativePlan;
  source: 'llm' | 'deterministic';
  attempts: number;
  lastIssues?: string[];
}> {
  const maxAttempts = 3;
  let lastIssues: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const llmPlan = await callOpenAiPlan(input, attempt).catch(() => null);
    const plan = llmPlan ?? (attempt === 1 ? deterministicPlan(input) : null);
    if (!plan) break;

    const template = getTemplateConfig(plan.templateKey);
    if (!template) {
      lastIssues = ['template inexistente'];
      continue;
    }

    const validation = validateCreativePlan(plan, template);
    if (validation.ok) {
      return {
        plan,
        source: llmPlan ? 'llm' : 'deterministic',
        attempts: attempt,
      };
    }

    lastIssues = validation.issues.map((i) => i.message);

    // Reintento LLM con issues; si era determinístico, acortar vía regenerate prompt
    if (!llmPlan) {
      // Forzar un plan determinístico más corto una sola vez
      const shorter = deterministicPlan({
        ...input,
        title: input.title.slice(0, Math.floor(template.maxHeadlineLength * 0.8)),
        summary: input.summary.slice(0, Math.floor(template.maxSubheadlineLength * 0.8)),
        mainInsight: input.mainInsight.slice(0, Math.floor(template.maxSubheadlineLength * 0.8)),
        keyPoints: input.keyPoints.map((p) => p.slice(0, template.maxBodyLineLength)),
      });
      const recheck = validateCreativePlan(shorter, getTemplateConfig(shorter.templateKey)!);
      if (recheck.ok) {
        return { plan: shorter, source: 'deterministic', attempts: attempt, lastIssues };
      }
      break;
    }
  }

  const fallbackTemplate = getTemplateConfig(DEFAULT_FALLBACK_TEMPLATE_KEY)!;
  const fallback: CreativePlan = {
    templateKey: fallbackTemplate.templateKey,
    templateVersion: fallbackTemplate.version,
    intention: fallbackTemplate.category,
    headline: clip(input.title, fallbackTemplate.maxHeadlineLength),
    subheadline: clip(input.mainInsight || input.summary, fallbackTemplate.maxSubheadlineLength),
    cta: clip(input.cta || 'Leer artículo', fallbackTemplate.maxCtaLength),
    visualType: 'typographic',
    format: fallbackTemplate.defaultFormat,
  };

  return {
    plan: fallback,
    source: 'deterministic',
    attempts: maxAttempts,
    lastIssues,
  };
}
