/**
 * Sprint 2.1 — checklist AEO obligatorio post-writer.
 * Completa huecos (respuesta al inicio, en esta guía, FAQs, tabla) sin bloquear.
 */
import type { ArticleData, ArticleSection } from './article-template';
import type { StrategistPlan } from './types';

export type FaqPair = { q: string; a: string };

export function collectArticleFaqs(data: ArticleData | undefined | null): FaqPair[] {
  if (!data?.sections?.length) return [];
  const out: FaqPair[] = [];
  for (const section of data.sections) {
    for (const faq of section.faqs ?? []) {
      const q = faq.q?.trim();
      const a = faq.a?.trim();
      if (q && a) out.push({ q, a });
    }
  }
  return out;
}

function hasTable(data: ArticleData): boolean {
  return data.sections.some((s) => Boolean(s.table?.headers?.length && s.table.rows?.length));
}

function hasGuideRoadmap(data: ArticleData): boolean {
  const blob = `${data.lead} ${data.sections.map((s) => `${s.heading ?? ''} ${s.body ?? ''}`).join(' ')}`.toLowerCase();
  return /en esta gu[ií]a|qu[eé] vas a encontrar|en este art[ií]culo/.test(blob);
}

function defaultFaqs(plan: StrategistPlan): FaqPair[] {
  const topic = plan.topic;
  return [
    {
      q: `¿Qué es ${topic}?`,
      a: `${topic} es el conjunto de prácticas y señales que hacen que una PyME sea encontrada y citada en Google y en asistentes de IA (ChatGPT, Gemini, Claude), no solo en los diez enlaces azules.`,
    },
    {
      q: `¿Por qué importa ${topic} para una PyME?`,
      a: 'Porque cada vez más compradores preguntan a la IA antes de elegir proveedor. Si no aparecés en esas respuestas, perdés demanda de intención alta frente a competidores más visibles.',
    },
    {
      q: `¿Cómo empiezo con ${topic} esta semana?`,
      a: 'Medí impresiones por URL en Search Console, publicá contenido que responda preguntas reales de clientes y estructurá FAQ + evidencia. Cleexs ayuda a priorizar qué piezas faltan en el ecosistema.',
    },
    {
      q: `¿Cuánto tarda en verse impacto en ${topic}?`,
      a: 'En Google suele haber señales en 4–12 semanas si hay frescura y cobertura. En IA depende de autoridad, estructura y que el contenido sea citables (respuestas claras + fuentes).',
    },
  ];
}

function defaultTable(plan: StrategistPlan): NonNullable<ArticleSection['table']> {
  return {
    headers: ['Señal', 'Qué mirar', 'Acción'],
    rows: [
      ['Google', 'Impresiones / CTR por URL', `Priorizar URLs de ${plan.topic} con impresiones y poco clic`],
      ['IA', '¿Te mencionan asistentes?', 'Publicar FAQ y guías con respuesta al inicio'],
      ['Contenido', 'Cobertura del cluster', 'Completar FAQ, checklist y comparativa faltantes'],
    ],
  };
}

/**
 * Garantiza mínimos AEO en el ArticleData antes de renderizar HTML.
 */
export function enforceAeoChecklist(data: ArticleData, plan: StrategistPlan): ArticleData {
  const sections = [...data.sections];
  let lead = data.lead?.trim() || '';

  // 1) Respuesta al inicio
  if (!lead || lead.length < 40) {
    lead = `Respuesta directa: ${plan.topic} importa porque define si tu marca aparece en Google y en respuestas de IA cuando un cliente busca soluciones. Esta guía te da el mapa accionable.`;
  } else if (!/respuesta directa|en resumen|en corto|la clave|directa:/i.test(lead)) {
    lead = `Respuesta directa: ${lead}`;
  }

  // 2) "En esta guía"
  if (!hasGuideRoadmap({ ...data, lead, sections })) {
    sections.unshift({
      heading: 'En esta guía',
      body: `Vas a encontrar: (1) el diagnóstico rápido de ${plan.topic}, (2) pasos concretos para PyMEs LATAM, (3) errores comunes, (4) cómo medir en GSC/IA y (5) próximos pasos con Cleexs.`,
      items: [
        `Qué significa ${plan.topic} en la práctica`,
        'Qué medir antes de publicar más',
        'Acciones de esta semana',
        'Cómo saber si está funcionando',
      ],
    });
  }

  // 3) FAQs
  const faqs = collectArticleFaqs({ ...data, lead, sections });
  if (faqs.length < 3) {
    sections.push({
      heading: 'Preguntas frecuentes',
      faqs: defaultFaqs(plan),
    });
  }

  // 4) Tabla
  if (!hasTable({ ...data, lead, sections })) {
    const idx = sections.findIndex((s) => !s.table);
    if (idx >= 0) {
      sections[idx] = { ...sections[idx], table: defaultTable(plan) };
    } else {
      sections.push({
        heading: 'Señales a priorizar',
        table: defaultTable(plan),
      });
    }
  }

  // 5) Evidencia / callout si no hay ninguno
  if (!sections.some((s) => s.callout?.trim())) {
    const target = sections[Math.min(1, sections.length - 1)];
    if (target) {
      sections[sections.indexOf(target)] = {
        ...target,
        callout:
          'Evidencia operativa: cruzá impresiones de Search Console con 3 prompts en ChatGPT/Gemini sobre tu categoría. La brecha es tu deuda AEO.',
      };
    }
  }

  return {
    ...data,
    lead,
    sections,
    pieceType: data.pieceType || plan.pieceType,
  };
}

export function buildSeoSchemaGraph(input: {
  title: string;
  description: string;
  pieceType: string;
  faqs: FaqPair[];
  brandName?: string;
}) {
  const article = {
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    author: { '@type': 'Organization', name: input.brandName || 'Cleexs' },
  };

  const includeFaq =
    input.pieceType === 'faq' ||
    input.faqs.length >= 2 ||
    /faq|pregunta/i.test(input.title);

  if (!includeFaq || input.faqs.length === 0) {
    return {
      '@context': 'https://schema.org',
      ...article,
    };
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      article,
      {
        '@type': 'FAQPage',
        mainEntity: input.faqs.slice(0, 20).map((faq) => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.a,
          },
        })),
      },
    ],
  };
}

export function injectJsonLd(html: string, schema: unknown): string {
  if (!html || !schema) return html;
  if (/application\/ld\+json/i.test(html)) return html;
  const json = JSON.stringify(schema).replace(/</g, '\\u003c');
  const tag = `<script type="application/ld+json">${json}</script>`;
  if (/<\/div>\s*$/i.test(html.trim())) {
    return `${html.trim()}\n${tag}`;
  }
  return `${html}\n${tag}`;
}
