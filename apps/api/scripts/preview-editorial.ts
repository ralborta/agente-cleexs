/**
 * Renderiza un artículo de muestra con el template "editorial" para revisar el
 * diseño sin tocar la base ni generar contenido con el LLM.
 *
 *   npx tsx scripts/preview-editorial.ts [salida.html]
 */
import { writeFileSync } from 'node:fs';
import { renderArticleHtml, type ArticleData } from '../src/lib/agents/teo/article-template';
import { resolveBrandKit } from '../src/lib/branding/brand-kit';

const article: ArticleData = {
  kicker: 'Cleexs · Insights',
  title: 'Guía PRO: cómo lograr contenido citable por ChatGPT, Gemini y Claude',
  lead: 'Si tu contenido no aparece citado por ChatGPT, Gemini o Claude, está pasando algo concreto: esta guía te muestra cómo pasar de ser invisible a ser la fuente que los asistentes eligen.\n\nEl juego cambió: ya no basta con posicionar en Google. Ahora la visibilidad real llega cuando los LLM te citan como fuente.',
  pieceType: 'pillar',
  publishedAt: new Date().toISOString(),
  sections: [
    {
      heading: 'Guía rápida: los contenidos citables por ChatGPT, Gemini y Claude tienen 6 rasgos comunes',
      body: 'No es magia ni suerte. Se trata de cumplir con lo que la IA necesita para confiar, citar y recomendar tu contenido. Durante meses analizamos qué fuentes aparecen en ChatGPT, Gemini y Claude para las mismas consultas. Encontramos patrones claros en las constantes que sí son citables.',
      items: [
        'Responden preguntas reales: abren abordando con la intención de búsqueda conversacional',
        'Tienen autoría clara y verificable: el autor y la entidad están identificados sin ambigüedades',
        'Están estructurados para extraerse: usan títulos descriptivos, listas, tablas, definiciones y datos',
        'Aportan evidencia original o única: datos propios, estudios, marcos o ejemplos concretos',
        'Son fáciles de rastrear y validar: URL estable, contenido indexable, buenas visitas',
        'Mantienen frescura y actualización: el contenido se revisa y se mantiene vigente',
      ],
      callout:
        'Nadie te va a citar si tu contenido no dice nada que no esté ya escrito en otros diez lugares.',
      examples: [
        {
          title: 'Para equipos de marketing, contenidos y SEO',
          body: 'Con esta base podés hacer el primer diagnóstico gratis y ver qué asistentes ya te mencionan. Si te preocupa el ranking, [empezá por acá](https://cleexs.net/diagnostico).',
        },
      ],
    },
    {
      heading: 'Diagnóstico rápido: cómo te ven (ChatGPT, Gemini, Claude) ahora mismo',
      body: 'Antes de optimizar, tenés que saber desde dónde partís. Este diagnóstico te presenta lo que hoy es la fuente que los asistentes eligen y toma menos de una hora.',
      items: [
        'Usá siempre preguntas en ChatGPT y medí si te menciona',
        'Usá siempre preguntas en Gemini con acceso a la web',
        'Usá siempre preguntas en Claude con acceso a la web',
      ],
      table: {
        headers: ['Prueba', 'Qué medís', 'Qué esperar', 'Qué hacer si falla'],
        rows: [
          ['Pregunta transaccional', 'Si te menciona por nombre', 'Mención directa con enlace', 'Reforzá la página de servicio'],
          ['Pregunta de categoría', 'Si aparecés entre las opciones', 'Estar en el top 5 citado', 'Publicá comparativas'],
          ['Pregunta técnica', 'Si citan tu documentación', 'Cita textual de tu guía', 'Estructurá con encabezados'],
          ['Análisis competitivo', 'Qué fuentes usan tus rivales', 'Mapa de fuentes citadas', 'Cubrí los huecos temáticos'],
        ],
      },
      chart: {
        type: 'bar',
        title: 'Menciones en asistentes de IA antes y después de aplicar la guía',
        labels: ['ChatGPT', 'Gemini', 'Claude'],
        datasets: [
          { label: 'Antes (10 semanas)', data: [12, 8, 5] },
          { label: 'Después (10 semanas)', data: [41, 33, 26] },
        ],
        sourceNote: 'Estimación ilustrativa basada en casos típicos de clientes Cleexs',
      },
    },
    {
      heading: 'Preguntas frecuentes',
      faqs: [
        {
          q: '¿Cuánto tarda en verse el efecto?',
          a: 'Entre 6 y 12 semanas, según la frecuencia de rastreo y la autoridad previa del dominio.',
        },
        {
          q: '¿Sirve si mi sitio es chico?',
          a: 'Sí. Los asistentes priorizan especificidad y evidencia, no tamaño: un sitio chico con datos propios compite bien.',
        },
      ],
    },
  ],
  references: [
    {
      title: 'Google Search Central — Creating helpful, reliable content',
      url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content',
      note: 'Criterios de calidad que también usan los LLM',
    },
    {
      title: 'OpenAI — How ChatGPT browses the web',
      url: 'https://openai.com/index/chatgpt-plugins/',
      note: 'Cómo se seleccionan y citan las fuentes',
    },
  ],
};

const kit = resolveBrandKit({ templateId: 'editorial' }, 'Cleexs');
const body = renderArticleHtml(article, kit);

const page = `<!doctype html>
<html lang="es"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${article.title}</title>
<style>body{margin:0;padding:48px 24px;background:#fff}</style>
</head><body>${body}</body></html>`;

const out = process.argv[2] ?? '/tmp/preview-editorial.html';
writeFileSync(out, page, 'utf8');
console.log(`Preview escrito en ${out}`);
