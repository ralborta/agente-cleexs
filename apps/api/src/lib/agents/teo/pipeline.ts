import { runWriterRich } from './content-builder';
import type { StrategistPlan } from './types';

export type { StrategistPlan } from './types';

type TeoConfig = {
  tone?: string | null;
  topics?: string[] | null;
  frequency?: string | null;
  autoPublish?: boolean;
};

export function runStrategist(config: TeoConfig, missionIndex: number, overrides?: Partial<StrategistPlan>): StrategistPlan {
  const topics = Array.isArray(config.topics) && config.topics.length > 0
    ? config.topics
    : ['visibilidad en IA', 'SEO', 'AEO'];
  const topic = overrides?.topic?.trim() || topics[missionIndex % topics.length];
  const types = ['faq', 'comparison', 'checklist', 'how_to', 'pillar'] as const;
  const pieceType = (overrides?.pieceType as StrategistPlan['pieceType']) || types[missionIndex % types.length];
  const title =
    overrides?.title?.trim() ||
    (pieceType === 'faq'
      ? `FAQ: ${topic}`
      : pieceType === 'comparison'
        ? `Comparativa: ${topic}`
        : pieceType === 'checklist'
          ? `Checklist: ${topic}`
          : pieceType === 'how_to'
            ? `Cómo mejorar ${topic}`
            : `Guía PRO: ${topic} para PyMEs`);

  const depth = overrides?.depth ?? (pieceType === 'pillar' ? 'pro' : 'standard');

  return {
    topic,
    pieceType,
    title,
    keyword: overrides?.keyword?.trim() || topic,
    objective:
      overrides?.objective?.trim() ||
      `Generar pieza tipo ${pieceType} sobre "${topic}" para rankear en Google y ser citables por IA.`,
    depth,
  };
}

export function runResearcher(plan: StrategistPlan) {
  const isPro = plan.depth === 'pro' || plan.pieceType === 'pillar';
  return {
    outline: isPro
      ? [
          `Contexto: ${plan.topic} en Google e IA (2025–2026)`,
          'Diagnóstico rápido: qué medir antes de publicar',
          'Ejemplos aplicados a PyMEs latinoamericanas',
          'Arquitectura de contenido (pilar + satélites + FAQ schema)',
          'Errores comunes y cómo evitarlos',
          'Plan 90 días con medición (GSC + visibilidad en IA)',
        ]
      : [
          `Introducción: qué es ${plan.topic} y por qué importa`,
          'Problema que resuelve para PyMEs',
          'Pasos o respuestas concretas',
          'Errores comunes',
          'Cómo Cleexs ayuda en este tema',
          'Conclusión con CTA',
        ],
    sources: isPro
      ? [
          'Google Search Central — AI Overviews',
          'llms.txt / especificación para LLMs',
          'Google Search Console (impresiones por URL)',
          'Schema.org FAQPage / Article',
          'Diagnóstico Cleexs (app.cleexs.net)',
        ]
      : [
          'Google Search Console — datos del workspace',
          'Documentación pública de Cleexs',
          'Buenas prácticas AEO/SEO 2025',
        ],
  };
}

export async function runWriter(
  plan: StrategistPlan,
  research: ReturnType<typeof runResearcher>,
  tone?: string | null,
) {
  return runWriterRich(plan, research, tone);
}

export type WriterDraft = Awaited<ReturnType<typeof runWriter>>;

export function runSeoBuilder(plan: StrategistPlan, draft: WriterDraft) {
  const slug = plan.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    metaTitle: `${plan.title} | Cleexs`,
    metaDescription: draft.excerpt,
    canonical: `https://cleexs.net/articulos/${slug}`,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: plan.title,
      description: draft.excerpt,
    },
    openGraph: {
      title: plan.title,
      description: draft.excerpt,
      type: 'article',
    },
    slug,
  };
}
