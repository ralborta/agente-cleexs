/* eslint-disable */
// Compara calidad y costo real por modelo para el escritor de Teo.
// Uso: OPENAI_API_KEY=... node scripts/compare-writer-models.js gpt-5.6-luna gpt-5.4-mini
const { generateArticleWithLlm } = require('../dist/lib/agents/teo/llm-writer.js');

// USD por millón de tokens (precios públicos de OpenAI).
const PRICING = {
  'gpt-5.5': { in: 5, out: 30 },
  'gpt-5.4': { in: 2.5, out: 15 },
  'gpt-5.4-mini': { in: 0.75, out: 4.5 },
  'gpt-5.4-nano': { in: 0.2, out: 1.25 },
  'gpt-5.6-terra': { in: 2, out: 12 },
  'gpt-5.6-luna': { in: 0.2, out: 1.2 },
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gpt-4.1-mini': { in: 0.4, out: 1.6 },
};

const plan = {
  topic: 'contenido citable por asistentes de IA',
  pieceType: 'pillar',
  title: 'Guía PRO: contenido citable por asistentes de IA para PyMEs',
  keyword: 'contenido citable por IA',
  objective: 'Guía profunda para que una PyME logre ser citada por asistentes de IA.',
  depth: 'pro',
};

const research = {
  outline: [
    'Qué significa contenido citable por asistentes de IA',
    'Diagnóstico antes de publicar',
    'Arquitectura pilar + satélites + FAQs',
    'Errores comunes',
    'Plan 30/60/90 días con métricas',
  ],
  sources: ['Google Search Central — AI features', 'llms.txt', 'Schema.org FAQPage'],
};

function analyze(article) {
  const words = [
    article.lead,
    ...article.sections.flatMap((s) => [
      s.body || '',
      s.callout || '',
      ...(s.items || []),
      ...(s.faqs || []).flatMap((f) => [f.q, f.a]),
      ...(s.examples || []).flatMap((e) => [e.title, e.body]),
    ]),
  ]
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;

  return {
    secciones: article.sections.length,
    palabras: words,
    graficos: article.sections.filter((s) => s.chart).length,
    tablas: article.sections.filter((s) => s.table).length,
    ejemplos: article.sections.reduce((a, s) => a + (s.examples || []).length, 0),
    callouts: article.sections.filter((s) => s.callout).length,
    referencias: (article.references || []).length,
  };
}

(async () => {
  const models = process.argv.slice(2);
  if (!models.length) {
    console.error('Pasá al menos un modelo. Ej: node scripts/compare-writer-models.js gpt-5.6-luna');
    process.exit(1);
  }

  const rows = [];

  for (const model of models) {
    process.env.OPENAI_MODEL = model;
    // llm-writer lee OPENAI_MODEL al cargar el módulo, así que se recarga por modelo.
    delete require.cache[require.resolve('../dist/lib/agents/teo/llm-writer.js')];
    const { generateArticleWithLlm: gen } = require('../dist/lib/agents/teo/llm-writer.js');

    const started = Date.now();
    let usage = null;
    const origInfo = console.info;
    console.info = (msg) => {
      const m = String(msg).match(/in=(\d+) out=(\d+)/);
      if (m) usage = { in: Number(m[1]), out: Number(m[2]) };
      else origInfo(msg);
    };

    try {
      const article = await gen(plan, research, 'profesional y claro');
      console.info = origInfo;
      const secs = ((Date.now() - started) / 1000).toFixed(0);
      const stats = analyze(article);
      const p = PRICING[model];
      const cost =
        p && usage ? (usage.in / 1e6) * p.in + (usage.out / 1e6) * p.out : null;

      rows.push({ model, secs, ...stats, usage, cost });
      console.log(
        `${model.padEnd(14)} | ${secs}s | ${stats.palabras} palabras | ${stats.secciones} sec | ${stats.graficos} graf | ${stats.tablas} tab | ${stats.referencias} refs | ${
          cost !== null ? '$' + cost.toFixed(4) : 'costo ?'
        }`,
      );
      require('fs').writeFileSync(
        `/tmp/cmp_${model}.json`,
        JSON.stringify(article, null, 2),
      );
    } catch (err) {
      console.info = origInfo;
      console.log(`${model.padEnd(14)} | FALLO: ${err.message}`);
      rows.push({ model, error: err.message });
    }
  }

  console.log('\n=== RESUMEN (JSON) ===');
  console.log(JSON.stringify(rows, null, 2));
})();
