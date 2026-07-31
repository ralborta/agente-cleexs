/* eslint-disable */
// Prueba local del escritor de Teo con distintos modelos.
// Uso: OPENAI_API_KEY=... OPENAI_MODEL=gpt-5.5 node scripts/test-writer-model.js
const { generateArticleWithLlm } = require('../dist/lib/agents/teo/llm-writer.js');

const plan = {
  topic: 'visibilidad en IA para PyMEs',
  pieceType: 'comparison',
  title: 'Comparativa: cómo lograr visibilidad en IA para PyMEs',
  keyword: 'visibilidad en IA',
  objective: 'Comparar enfoques para ganar visibilidad en Google e IA.',
  depth: 'pro',
};

const research = {
  outline: [
    'Contexto: visibilidad en IA en Google e IA (2025-2026)',
    'Comparativa de enfoques y costos',
    'Ejemplos aplicados a PyMEs latinoamericanas',
    'Errores comunes',
    'Plan de implementación con medición',
  ],
  sources: [
    'Google Search Central — AI Overviews',
    'llms.txt specification',
    'Google Search Console',
  ],
};

(async () => {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const started = Date.now();
  try {
    const article = await generateArticleWithLlm(plan, research, 'profesional y claro');
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

    const charts = article.sections.filter((s) => s.chart);
    console.log('=== modelo:', model, '| tiempo:', ((Date.now() - started) / 1000).toFixed(1) + 's');
    console.log('secciones:', article.sections.length);
    console.log('palabras:', words);
    console.log('graficos:', charts.length, charts.map((s) => s.chart.type).join(','));
    console.log('tablas:', article.sections.filter((s) => s.table).length);
    console.log('ejemplos:', article.sections.reduce((a, s) => a + (s.examples || []).length, 0));
    console.log('callouts:', article.sections.filter((s) => s.callout).length);
    console.log('referencias:', (article.references || []).length);
    console.log(
      'palabras por seccion:',
      article.sections.map((s) => (s.body || '').split(/\s+/).filter(Boolean).length).join(','),
    );
    if (charts[0]) console.log('ejemplo chart:', JSON.stringify(charts[0].chart).slice(0, 300));
    require('fs').writeFileSync(
      `/tmp/teo_test_${model}.json`,
      JSON.stringify(article, null, 2),
    );
  } catch (err) {
    console.error('ERROR con', model, ':', err.message);
    process.exit(1);
  }
})();
