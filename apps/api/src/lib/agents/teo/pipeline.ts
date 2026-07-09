import { runWriterRich } from './content-builder';
import type { StrategistPlan } from './types';

export type { StrategistPlan } from './types';

type TeoConfig = {
  tone?: string | null;
  topics?: string[] | null;
  frequency?: string | null;
  autoPublish?: boolean;
};

export function runStrategist(config: TeoConfig, missionIndex: number): StrategistPlan {
  const topics = Array.isArray(config.topics) && config.topics.length > 0
    ? config.topics
    : ['visibilidad en IA', 'SEO', 'AEO'];
  const topic = topics[missionIndex % topics.length];
  const types = ['faq', 'comparison', 'checklist', 'how_to', 'pillar'] as const;
  const pieceType = types[missionIndex % types.length];
  const title = pieceType === 'faq'
    ? `FAQ: ${topic}`
    : pieceType === 'comparison'
      ? `Comparativa: ${topic}`
      : pieceType === 'checklist'
        ? `Checklist: ${topic}`
        : pieceType === 'how_to'
          ? `Cómo mejorar ${topic}`
          : `Guía completa sobre ${topic}`;

  return {
    topic,
    pieceType,
    title,
    keyword: topic,
    objective: `Generar pieza tipo ${pieceType} sobre "${topic}" para rankear en Google y ser citables por IA.`,
  };
}

export function runResearcher(plan: StrategistPlan) {
  return {
    outline: [
      `Introducción: qué es ${plan.topic} y por qué importa`,
      'Problema que resuelve para PyMEs',
      'Pasos o respuestas concretas',
      'Errores comunes',
      'Cómo Cleexs ayuda en este tema',
      'Conclusión con CTA',
    ],
    sources: [
      'Google Search Console — datos del workspace',
      'Documentación pública de Cleexs',
      'Buenas prácticas AEO/SEO 2025',
    ],
  };
}

export function runWriter(plan: StrategistPlan, research: ReturnType<typeof runResearcher>, tone?: string | null) {
  return runWriterRich(plan, research, tone);
}

export function runSeoBuilder(plan: StrategistPlan, draft: ReturnType<typeof runWriter>) {
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
