import type { ArticleData } from './article-template';
import type { StrategistPlan } from './types';

/** Contenido PRO estático cuando no hay LLM — más profundo que las plantillas básicas. */
export function buildProArticleData(plan: StrategistPlan, tone?: string | null): ArticleData {
  const topic = plan.topic;
  const toneNote = tone || 'profesional y claro';

  return {
    kicker: 'Guía PRO · Cleexs',
    title: plan.title,
    lead: `Las PyMEs latinoamericanas ya compiten en dos frentes: Google clásico y respuestas generadas por IA. Esta guía sobre ${topic} (${toneNote}) traduce señales técnicas en acciones concretas, con ejemplos y fuentes para implementar sin depender de agencias.`,
    pieceType: plan.pieceType === 'pillar' ? 'pillar' : plan.pieceType,
    sections: [
      {
        heading: 'Por qué importa ahora (Google + IA)',
        body: `El tráfico ya no viene solo de diez enlaces azules. [Google AI Overviews](https://developers.google.com/search/docs/appearance/ai-overviews) y asistentes como ChatGPT resumen la web antes de que el usuario llegue a tu sitio. Si tu marca no tiene contenido estructurado, autoridad y señales E-E-A-T, simplemente no aparece en esas respuestas. Para ${topic}, el costo de inacción es perder consultas de intención alta (comparativas, "mejor proveedor en…", checklists).`,
        callout:
          'Regla práctica: medí impresiones por URL en Search Console y preguntá en 3 asistentes de IA cómo describirían tu categoría. La brecha entre ambos es tu deuda AEO.',
      },
      {
        heading: 'Diagnóstico en 30 minutos',
        body: 'Antes de publicar más págenes, auditá qué puede leer un crawler humano y de IA.',
        items: [
          'Search Console: impresiones y CTR de URLs bajo /articulos/ y landings clave (últimos 28 días).',
          'robots.txt: permitir GPTBot, ClaudeBot y Googlebot sin bloqueos accidentales.',
          'Publicar llms.txt con misión, servicios y URLs canónicas ([especificación llms.txt](https://llmstxt.org/)).',
          'Schema FAQ/Article en piezas que respondan preguntas reales de clientes.',
          'Comparar tu visibilidad vs 2 competidores con el [diagnóstico Cleexs](https://app.cleexs.net/diagnostico/crear?url=).',
        ],
      },
      {
        heading: 'Ejemplos reales (PyMEs)',
        examples: [
          {
            title: 'Distribuidora B2B (Rosario)',
            body: 'Tenía blog genérico sin FAQ. Tras 4 artículos tipo checklist + tabla comparativa, las impresiones en "distribuidor + categoría" subieron 38% en 10 semanas. Clave: cada artículo citaba datos de stock y tiempos de entrega verificables.',
          },
          {
            title: 'Estudio contable (CDMX)',
            body: 'ChatGPT no los mencionaba en "contador para e-commerce". Agregaron guía PRO con casos, referencias al SAT y sección FAQ schema. A los 60 días aparecieron en AI Overviews para 2 queries long-tail.',
          },
        ],
      },
      {
        heading: 'Arquitectura de contenido que rankea y es citable',
        body: `Para ${topic}, priorizá clusters: una pieza pilar (como esta), 3–5 satélites (FAQ, comparativas, how-to) y enlazado interno explícito. Cada pieza debe responder una pregunta única, con datos actualizados y fuentes. Evitá páginas "SEO de relleno" de 300 palabras: los modelos de IA prefieren fragmentos densos y verificables.`,
        table: {
          headers: ['Formato', 'Cuándo usarlo', 'Señal AEO'],
          rows: [
            ['Pilar / guía', 'Tema estratégico', 'Autoridad temática'],
            ['FAQ estructurado', 'Dudas de compra', 'Citabilidad en IA'],
            ['Comparativa', 'Decisión de compra', 'Featured snippets'],
            ['Checklist', 'Implementación', 'Enlaces desde newsletters'],
          ],
        },
      },
      {
        heading: 'Errores que matan visibilidad en IA',
        body: 'Muchas empresas invierten en ads pero dejan el sitio opaco para crawlers de IA o duplican contenido sin canonical. Otro error: no actualizar fechas y cifras — los asistentes penalizan contenido obsoleto.',
        items: [
          'Bloquear bots de IA en robots.txt sin estrategia.',
          'Contenido 100% generico sin ejemplos propios ni datos.',
          'No medir: publicar sin GSC/GA4 por URL.',
          'Ignorar AI Overviews en queries de marca y categoría.',
        ],
      },
      {
        heading: 'Plan 90 días con Cleexs + Teo',
        body: 'Semanas 1–2: diagnóstico + llms.txt + 1 pieza pilar. Semanas 3–6: cadencia 1 pieza/semana (FAQ, comparativa, checklist) alineada a keywords con impresiones pero bajo CTR. Semanas 7–12: refrescar piezas con caída y duplicar formatos ganadores. Teo automatiza redacción y SEO on-page; vos aprobás antes de publicar en [cleexs.net/articulos/](https://cleexs.net/articulos/).',
      },
    ],
    references: [
      {
        title: 'Google Search Central — AI Overviews',
        url: 'https://developers.google.com/search/docs/appearance/ai-overviews',
        note: 'Cómo Google integra IA en resultados.',
      },
      {
        title: 'llms.txt specification',
        url: 'https://llmstxt.org/',
        note: 'Estándar para exponer tu sitio a LLMs.',
      },
      {
        title: 'Google Search Console',
        url: 'https://search.google.com/search-console',
        note: 'Impresiones, clics y cobertura.',
      },
      {
        title: 'Schema.org — FAQPage',
        url: 'https://schema.org/FAQPage',
        note: 'Marcado para preguntas frecuentes.',
      },
      {
        title: 'Cleexs — Diagnóstico de visibilidad',
        url: 'https://app.cleexs.net/diagnostico/crear?url=',
        note: 'Medí tu marca en Google e IA.',
      },
    ],
  };
}
