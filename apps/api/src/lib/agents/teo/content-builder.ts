import { articleToMarkdown, renderArticleHtml, type ArticleData } from './article-template';
import { generateArticleWithLlm, isLlmWriterEnabled } from './llm-writer';
import { buildProArticleData } from './pro-content-fallback';
import { enforceAeoChecklist } from './aeo-checklist';
import { applyFounderVoiceToArticle } from './founder-voice';
import { buildSvgCover, generateFeaturedCover } from './media-cover';
import { fixUtf8Mojibake, fixUtf8MojibakeDeep } from '../../agent-helpers';
import type { BrandKit } from '@agente/shared';
import type { StrategistPlan } from './types';

type Research = import('./types').ResearchResult;

export function buildArticleData(
  plan: StrategistPlan,
  research: Research,
  tone?: string | null,
): ArticleData {
  const kicker = plan.topic;
  const lead = `Guía práctica sobre ${plan.topic} para PyMEs latinoamericanas. Tono: ${tone || 'profesional y claro'}.`;

  switch (plan.pieceType) {
    case 'faq':
      return {
        kicker,
        title: plan.title,
        lead,
        pieceType: 'faq',
        sections: [
          {
            heading: 'Preguntas frecuentes',
            faqs: [
              {
                q: `¿Qué es ${plan.topic}?`,
                a: `${plan.topic} es la capacidad de una marca de ser encontrada, mencionada y citada en buscadores tradicionales y asistentes de IA como ChatGPT y Google AI Overviews.`,
              },
              {
                q: '¿Por qué importa para mi negocio?',
                a: 'Cada vez más personas preguntan a la IA antes de comprar. Si tu marca no aparece en esas respuestas, perdés oportunidades frente a competidores que sí están visibles.',
              },
              {
                q: '¿Cómo puede ayudar Cleexs?',
                a: 'Cleexs mide tu visibilidad en Google e IA, compara con competidores y te indica qué contenido crear para mejorar tu presencia.',
              },
              {
                q: '¿Cuánto tarda en verse resultados?',
                a: 'Las mejoras de contenido suelen reflejarse en 4–12 semanas en impresiones de Google; la visibilidad en IA depende de autoridad y frescura del contenido.',
              },
            ],
          },
          {
            heading: 'Próximos pasos',
            items: research.outline.slice(0, 4),
          },
        ],
      };

    case 'checklist':
      return {
        kicker,
        title: plan.title,
        lead: `Lista de verificación para mejorar ${plan.topic} en tu sitio web.`,
        pieceType: 'checklist',
        sections: [
          {
            heading: 'Checklist esencial',
            items: [
              'Verificar que robots.txt permite crawlers de IA (GPTBot, ClaudeBot, etc.)',
              'Publicar llms.txt con información clave de tu marca',
              'Estructurar contenido con FAQ schema y datos claros',
              'Crear páginas que respondan preguntas concretas de tu industria',
              'Mantener contenido actualizado (fechas, cifras, casos)',
              'Medir impresiones en Google Search Console por URL',
              'Comparar tu visibilidad vs competidores con Cleexs',
            ],
          },
          {
            heading: 'Errores comunes',
            body: 'Muchas PyMEs ignoran la visibilidad en IA porque solo miran tráfico directo. Sin contenido estructurado y autoridad, los asistentes no te mencionan.',
          },
        ],
      };

    case 'comparison':
      return {
        kicker,
        title: plan.title,
        lead: `Comparativa de enfoques para lograr ${plan.topic}.`,
        pieceType: 'comparison',
        sections: [
          {
            heading: 'Comparativa de opciones',
            table: {
              headers: ['Enfoque', 'Ventaja', 'Limitación'],
              rows: [
                ['SEO tradicional solo', 'Tráfico en Google', 'No optimiza para IA'],
                ['Contenido genérico con IA', 'Rápido de producir', 'Poco diferenciado, baja autoridad'],
                ['Estrategia AEO + contenido estructurado', 'Google + IA', 'Requiere constancia y medición'],
                ['Cleexs (diagnóstico + contenido)', 'Medición + acción', 'Requiere implementar recomendaciones'],
              ],
            },
          },
          {
            heading: 'Recomendación',
            body: `Para ${plan.topic}, lo más efectivo es combinar contenido estructurado (FAQ, guías, casos) con medición continua de impresiones y menciones.`,
          },
        ],
      };

    case 'how_to':
      return {
        kicker,
        title: plan.title,
        lead: `Pasos concretos para mejorar ${plan.topic}.`,
        pieceType: 'how_to',
        sections: research.outline.map((heading, i) => ({
          heading,
          body: `Paso ${i + 1}: acciones concretas sobre ${plan.topic}. Incluí datos verificables, ejemplos de tu industria y enlaces internos a recursos relacionados.`,
        })),
      };

    case 'case_study':
      return {
        kicker,
        title: plan.title,
        lead: `Respuesta directa: un caso realista de PyME muestra cómo ${plan.topic} se traduce en impresiones y menciones medibles, no en teoría.`,
        pieceType: 'case_study',
        sections: [
          {
            heading: 'En esta guía',
            items: ['Contexto del negocio', 'Problema', 'Intervención', 'Resultados', 'Cómo replicarlo'],
          },
          {
            heading: 'Contexto y problema',
            body: `Una PyME de servicios B2B en LATAM tenía contenido genérico sobre ${plan.topic} y casi cero menciones en asistentes de IA, pese a algo de tráfico Google.`,
          },
          {
            heading: 'Resultados',
            table: {
              headers: ['Métrica', 'Antes', 'Después (10 semanas)'],
              rows: [
                ['Impresiones GSC', 'Bajas / irregulares', '+30–60% en URLs del cluster'],
                ['CTR', 'Estancado', 'Mejora en títulos con intención clara'],
                ['Menciones en IA', 'Raras', 'Aparece en prompts de categoría'],
              ],
            },
          },
          {
            heading: 'Preguntas frecuentes',
            faqs: [
              {
                q: '¿Sirve si soy más chico que este caso?',
                a: 'Sí: el patrón es el mismo — respuesta al inicio, FAQ reales, medición semanal. El tamaño del sitio cambia el ritmo, no el método.',
              },
              {
                q: '¿Cuánto contenido hace falta?',
                a: 'Empezá por un pilar + 3 satélites (FAQ, checklist, comparativa). Completá el ecosistema antes de disparar volumen.',
              },
            ],
          },
        ],
      };

    case 'landing':
      return {
        kicker,
        title: plan.title,
        lead: `Respuesta directa: ${plan.topic} es el punto de partida para que tu PyME sea encontrada en Google y citada por IA cuando un cliente pregunta por soluciones.`,
        pieceType: 'landing',
        sections: [
          {
            heading: 'En esta guía',
            items: ['El problema', 'Qué cambia con AEO', 'Plan de 30 días', 'Objeciones frecuentes'],
          },
          {
            heading: 'Opciones',
            table: {
              headers: ['Camino', 'Esfuerzo', 'Resultado típico'],
              rows: [
                ['Solo SEO clásico', 'Medio', 'Tráfico Google, poca IA'],
                ['Contenido genérico con IA', 'Bajo', 'Rápido, poco diferenciado'],
                ['Ecosistema AEO + medición', 'Medio-alto', 'Google + citas en asistentes'],
              ],
            },
          },
          {
            heading: 'Preguntas frecuentes',
            faqs: [
              {
                q: `¿Esto reemplaza mi SEO actual?`,
                a: 'No: lo extiende. Segís midiendo GSC, pero agregás estructura y evidencia para que la IA pueda citarte.',
              },
              {
                q: '¿Por dónde empiezo hoy?',
                a: `Definí 3 preguntas reales de clientes sobre ${plan.topic}, publicá respuestas claras y medí impresiones por URL en 28 días.`,
              },
            ],
          },
        ],
      };

    default:
      return {
        kicker,
        title: plan.title,
        lead: `Guía completa sobre ${plan.topic}.`,
        pieceType: plan.pieceType,
        sections: research.outline.map((heading) => ({
          heading,
          body: `Contenido detallado sobre ${heading.toLowerCase()} aplicado a ${plan.topic}.`,
        })),
      };
  }
}

/** Extracto para meta description: corta en palabra entera, no a la mitad. */
function buildExcerpt(lead: string, max = 160): string {
  const clean = lead.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:.–-]+$/, '')}…`;
}

export async function runWriterRich(
  plan: StrategistPlan,
  research: Research,
  tone?: string | null,
  branding?: BrandKit,
  opts?: { workspaceId?: string; workspaceSlug?: string; pieceId?: string },
) {
  // Todas las piezas pasan por el LLM real, no solo las "pro"/pilar. El fallback
  // estático (buildProArticleData) es la red de seguridad si no hay API key o falla OpenAI,
  // nunca el camino principal — así ninguna pieza sale con texto repetido/genérico.
  let articleData: ArticleData;
  let writerMode: 'llm' | 'pro_fallback' = 'pro_fallback';

  if (isLlmWriterEnabled()) {
    try {
      articleData = await generateArticleWithLlm(plan, research, tone, branding);
      writerMode = 'llm';
    } catch (err) {
      console.warn(
        '[teo-writer] LLM falló, usando fallback PRO:',
        err instanceof Error ? err.message : err,
      );
      articleData = buildProArticleData(plan, tone);
      writerMode = 'pro_fallback';
    }
  } else {
    articleData = buildProArticleData(plan, tone);
    writerMode = 'pro_fallback';
  }

  articleData = enforceAeoChecklist(articleData, plan);
  articleData = fixUtf8MojibakeDeep({
    ...articleData,
    title: fixUtf8Mojibake(plan.title),
  });

  let founderQuoteIds: string[] = [];
  let founderInjected = 0;
  if (opts?.workspaceId) {
    const voice = await applyFounderVoiceToArticle(opts.workspaceId, plan, articleData);
    articleData = fixUtf8MojibakeDeep(voice.article);
    founderQuoteIds = voice.quoteIds;
    founderInjected = voice.injected;
  }

  // Portada: SVG siempre en HTML; GPT Image Mini opcional para featured_media WP.
  try {
    const cover = await generateFeaturedCover({
      title: articleData.title,
      topic: fixUtf8Mojibake(plan.topic),
      pieceType: plan.pieceType,
      kicker: articleData.kicker,
      branding,
    });
    const svgForHtml =
      cover.source === 'dalle'
        ? buildSvgCover({
            title: articleData.title,
            kicker: articleData.kicker,
            pieceType: plan.pieceType,
            branding,
            template: cover.template,
          })
        : cover;
    articleData = {
      ...articleData,
      featuredImage: {
        url: svgForHtml.url,
        alt: cover.alt,
        template: cover.template,
        source: cover.source,
        remoteUrl: cover.source === 'dalle' ? cover.url : undefined,
      },
    };
  } catch (err) {
    console.warn('[teo-writer] cover falló:', err instanceof Error ? err.message : err);
    const fallback = buildSvgCover({
      title: plan.title,
      kicker: articleData.kicker,
      pieceType: plan.pieceType,
      branding,
    });
    articleData = {
      ...articleData,
      featuredImage: {
        url: fallback.url,
        alt: fallback.alt,
        template: fallback.template,
        source: fallback.source,
      },
    };
  }

  const html = renderArticleHtml(articleData, branding ?? undefined, {
    pieceId: opts?.pieceId,
    workspaceSlug: opts?.workspaceSlug,
    trackBaseUrl: process.env.API_PUBLIC_URL,
  });
  // renderArticleHtml asigna ctaVariant sticky en articleData
  const excerpt = buildExcerpt(articleData.lead);
  const bodyMarkdown = articleToMarkdown(articleData);

  return {
    articleData,
    html,
    excerpt,
    bodyMarkdown,
    writerMode,
    founderQuoteIds,
    founderInjected,
    coverTemplate: articleData.featuredImage?.template ?? null,
    coverSource: articleData.featuredImage?.source ?? null,
  };
}
