/**
 * Publica en empliados.net (draft) un artículo basado en el screen Stitch
 * "Guía: Agentes de IA en Logística - Empliados.net (Clean Light)".
 * Solo contenido + estilo modern light (sin nav/sidebar/footer del mock).
 *
 * Uso: npx tsx apps/api/scripts/publish-stitch-empleados-draft.ts
 */
import { PrismaClient } from '@prisma/client';
import type { ArticleData } from '../src/lib/agents/teo/article-template';
import { renderArticleHtml } from '../src/lib/agents/teo/article-template';
import { resolveBrandKit } from '../src/lib/branding/brand-kit';
import { publishAndRecordPiece } from '../src/lib/integrations/wordpress-publish';

const prisma = new PrismaClient();

const STITCH_MODERN_BRANDING = {
  brandName: 'Empleados',
  primaryColor: '#2563EB',
  secondaryColor: '#1D4ED8',
  fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
  authorLine: 'Por Teo · Agente de contenido Empleados',
  templateId: 'modern' as const,
  cta: {
    headline: 'Calculá el impacto en tu operación',
    body: 'Pegá la URL de tu sitio y descubrí cómo potenciar tu marca y procesos con agentes de IA.',
    label: 'Empezá gratis',
    url: 'https://empliados.net/',
    buttonColor: '#FFFFFF',
    urlInput: false,
  },
  distribution: {
    accentColor: '#7E22CE',
    backgroundColor: '#F8FAFC',
    fontPrimary: '"Inter", system-ui, sans-serif',
    fontSecondary: '"Inter", system-ui, sans-serif',
    visualStyle: 'clean_light_blog',
    defaultCta: 'Leer artículo',
    website: 'https://empliados.net',
  },
};

function buildArticleFromStitch(): ArticleData {
  return {
    kicker: 'Guía operativa · Empliados.net',
    title: 'Cómo desplegar agentes de IA autónomos en centros logísticos y flotas',
    lead:
      'La transición de la automatización rígida (RPA) a agentes cognitivos con toma de decisiones en tiempo real: guía técnica y operativa para directores de operaciones y supply chain.',
    pieceType: 'how_to',
    publishedAt: new Date().toISOString(),
    sections: [
      {
        heading: 'Del WMS estático a la orquestación agéntica',
        body:
          'Durante las últimas dos décadas, la columna vertebral logística ha dependido de sistemas de ejecución monolíticos como SAP WM, Manhattan Associates o Blue Yonder. Estos motores destacan en la ejecución determinista, pero fallan cuando el entorno se vuelve estocástico.\n\nEl software tradicional se limita a lanzar alertas pasivas que saturan la bandeja del despachador. En contraste, un agente de IA autónomo opera en un ciclo continuo de percepción, deliberación y ejecución: detecta el patrón, recalcula y actúa sin esperar una intervención humana para cada micro-decisión.',
        callout:
          'Los agentes no reemplazan la intuición del jefe de tráfico: descargan la fricción de micro-decisiones que causan parálisis operativa.',
        examples: [
          {
            title: 'Qué cambia en la práctica',
            body:
              'Entidades de software autónomas que resuelven disrupciones de rutas, inventario fantasma y despachos sin intervención humana continua mediante razonamiento heurístico.',
          },
        ],
      },
      {
        heading: 'Resolución autónoma de excepciones en tránsito',
        body:
          'Los agentes de IA pueden resolver una fracción alta de disrupciones de tránsito (clima adverso, congestión aduanera, averías leves) en segundos, sin requerir un ticket humano para cada incidente.\n\nLa arquitectura se integra de forma no invasiva sobre TMS/WMS tradicionales (SAP, Manhattan, Oracle) mediante conectores API REST y protocolos de inferencia tolerantes a latencia.',
        items: [
          'Ruteo predictivo dinámico ante demoras y clima',
          'Auditoría de carga y stock con telemetría continua',
          'Torre de control con nodos agentes por excepción',
        ],
      },
      {
        heading: 'Sistemas tradicionales (TMS/WMS) vs agentes de IA',
        body:
          'La dicotomía entre sistemas pasivos y arquitectura agéntica define qué empresas absorben las perturbaciones del canal y cuáles incurren en costes extraordinarios.',
        table: {
          headers: ['Dimensión', 'TMS/WMS tradicional', 'Agentes de IA'],
          rows: [
            ['Respuesta a excepciones', 'Alertas pasivas / cola humana', 'Ciclo percepción → acción'],
            ['Integración', 'Monolito / batch', 'API REST sobre stack existente'],
            ['Objetivo', 'Ejecutar el plan', 'Adaptar el plan en tiempo real'],
          ],
        },
      },
      {
        heading: 'Checklist de madurez para implementar agentes',
        body:
          'Antes de desplegar nodos autónomos en hubs de distribución, verificá si tu infraestructura cumple los requisitos de telemetría y gobierno operativo:',
        items: [
          'Telemetría de flota/hub disponible por API',
          'Reglas claras de qué puede decidir el agente sin humano',
          'Conectores al TMS/WMS sin reescribir el core',
          'Métricas de SLA y costo por excepción instrumentadas',
          'Playbook de override humano para casos críticos',
        ],
      },
      {
        heading: 'Dudas clave de integración',
        faqs: [
          {
            q: '¿Hay que reemplazar el WMS/TMS?',
            a: 'No. El patrón recomendado es orquestación agéntica encima del stack actual vía API.',
          },
          {
            q: '¿Qué porcentaje de excepciones puede resolver un agente?',
            a: 'Depende de la madurez de datos; en despliegues maduros se reportan resoluciones altas de disrupciones leves en minutos.',
          },
          {
            q: '¿Dónde queda el operador humano?',
            a: 'En supervisión, excepciones de alto impacto y mejora continua de políticas del agente.',
          },
        ],
      },
    ],
  };
}

async function main() {
  const workspace = await prisma.workspace.findUnique({ where: { slug: 'empleados' } });
  if (!workspace) throw new Error('Workspace empleados no existe');

  const teo = await prisma.agent.findUnique({ where: { slug: 'teo' } });
  if (!teo) throw new Error('Agente teo no existe');

  await prisma.agentConfig.upsert({
    where: {
      workspaceId_agentId: { workspaceId: workspace.id, agentId: teo.id },
    },
    update: { branding: STITCH_MODERN_BRANDING },
    create: {
      workspaceId: workspace.id,
      agentId: teo.id,
      tone: 'Profesional, claro, orientado a operaciones y talento',
      topics: ['agentes de IA', 'logística', 'marca empleadora', 'automatización'],
      frequency: '2/semana',
      autoPublish: false,
      branding: STITCH_MODERN_BRANDING,
    },
  });

  const article = buildArticleFromStitch();
  const kit = resolveBrandKit(STITCH_MODERN_BRANDING, workspace.name);

  const piece = await prisma.contentPiece.create({
    data: {
      workspaceId: workspace.id,
      type: 'how_to',
      title: article.title,
      slug: 'agentes-ia-autonomos-centros-logisticos-flotas',
      keyword: 'agentes de IA logística',
      status: 'draft',
      content: {
        articleData: article,
        excerpt: article.lead.slice(0, 240),
        html: '', // se completa al renderizar
      },
      seoMeta: {
        metaTitle: article.title.slice(0, 60),
        metaDescription: article.lead.slice(0, 155),
      },
    },
  });

  const html = renderArticleHtml(article, kit, { pieceId: piece.id });
  await prisma.contentPiece.update({
    where: { id: piece.id },
    data: {
      content: {
        articleData: article,
        excerpt: article.lead.slice(0, 240),
        html,
      },
    },
  });

  const updated = await prisma.contentPiece.findUniqueOrThrow({ where: { id: piece.id } });
  const result = await publishAndRecordPiece('empleados', workspace.id, updated, {
    wpStatus: 'draft',
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        pieceId: piece.id,
        template: 'modern',
        source: 'stitch:Modern Blog Template Redesign / Clean Light',
        wordpress: result,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
