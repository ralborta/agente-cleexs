import { renderArticleHtml, type ArticleData } from './article-template';
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

export function runWriterRich(plan: StrategistPlan, research: Research, tone?: string | null) {
  const articleData = buildArticleData(plan, research, tone);
  const html = renderArticleHtml(articleData);
  const excerpt = articleData.lead.slice(0, 160);

  return {
    articleData,
    html,
    excerpt,
    bodyMarkdown: `# ${plan.title}\n\n${articleData.lead}`,
  };
}
