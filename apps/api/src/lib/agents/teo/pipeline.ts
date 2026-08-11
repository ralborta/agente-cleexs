import { fixUtf8Mojibake, slugify } from '../../agent-helpers';
import { runWriterRich } from './content-builder';
import { buildTitle } from './strategist-metrics';
import { runWebResearch } from './web-research';
import { buildSeoSchemaGraph, collectArticleFaqs, injectJsonLd } from './aeo-checklist';
import type { BrandKit } from '@agente/shared';
import type { ResearchResult, StrategistPlan } from './types';

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
  const types = ['faq', 'comparison', 'checklist', 'how_to', 'pillar', 'case_study', 'landing'] as const;
  const pieceType = (overrides?.pieceType as StrategistPlan['pieceType']) || types[missionIndex % types.length];
  const title = fixUtf8Mojibake(overrides?.title?.trim() || buildTitle(pieceType, topic));

  const depth = overrides?.depth ?? (pieceType === 'pillar' ? 'pro' : 'standard');

  return {
    topic: fixUtf8Mojibake(topic),
    pieceType,
    title,
    keyword: fixUtf8Mojibake(overrides?.keyword?.trim() || topic),
    objective: fixUtf8Mojibake(
      overrides?.objective?.trim() ||
        `Generar pieza tipo ${pieceType} sobre "${topic}" para rankear en Google y ser citables por IA.`,
    ),
    depth,
  };
}

/**
 * Devuelve outline + fuentes para el escritor. Si hay TAVILY_API_KEY configurada,
 * intenta primero una investigación real en la web (fuentes verificadas con URL
 * y resumen); si no está disponible o falla, usa el outline/fuentes estáticas
 * como red de seguridad (nunca rompe la generación de la pieza).
 */
export async function runResearcher(plan: StrategistPlan): Promise<ResearchResult> {
  const isPro = plan.depth === 'pro' || plan.pieceType === 'pillar';

  const outline = isPro
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
      ];

  const staticSources = isPro
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
      ];

  const webResearch = await runWebResearch(plan).catch((err) => {
    console.warn('[teo-researcher] research web falló:', err instanceof Error ? err.message : err);
    return null;
  });

  return {
    outline,
    sources: webResearch?.sources?.length ? webResearch.sources : staticSources,
  };
}

export async function runWriter(
  plan: StrategistPlan,
  research: Awaited<ReturnType<typeof runResearcher>>,
  tone?: string | null,
  branding?: BrandKit,
  opts?: { workspaceId?: string; workspaceSlug?: string; pieceId?: string },
) {
  return runWriterRich(plan, research, tone, branding, opts);
}

export type WriterDraft = Awaited<ReturnType<typeof runWriter>>;

export function runSeoBuilder(plan: StrategistPlan, draft: WriterDraft, branding?: BrandKit) {
  const title = fixUtf8Mojibake(plan.title);
  const excerpt = fixUtf8Mojibake(draft.excerpt);
  const slug = slugify(title);

  const brandName = branding?.brandName?.trim() || 'Cleexs';
  const faqs = collectArticleFaqs(draft.articleData);
  const schema = buildSeoSchemaGraph({
    title,
    description: excerpt,
    pieceType: plan.pieceType,
    faqs,
    brandName,
  });
  const html = injectJsonLd(fixUtf8Mojibake(draft.html), schema);

  return {
    metaTitle: `${title} | ${brandName}`,
    metaDescription: excerpt,
    canonical: `https://cleexs.net/articulos/${slug}`,
    schema,
    openGraph: {
      title,
      description: excerpt,
      type: 'article',
    },
    slug,
    html,
    faqCount: faqs.length,
  };
}
