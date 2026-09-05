/**
 * Crea workspace empleados + AgentConfig Teo + user admin.
 * Empliados.net = agentes de IA orientados a logística (no RRHH).
 * Uso (en API): npx tsx apps/api/scripts/seed-empleados.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const LOGISTICS_TOPICS = [
  'agentes de IA logística',
  'automatización centros logísticos',
  'IA para flotas',
  'WMS con inteligencia artificial',
];

const DISCOVERY_SEEDS = [
  'agentes de IA logística',
  'automatización centros logísticos',
  'IA para flotas',
  'agentes autónomos warehouse',
];

const EMPLEADOS_BRANDING = {
  brandName: 'Empliados',
  primaryColor: '#2563EB',
  secondaryColor: '#1D4ED8',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  authorLine: 'Por Teo · Agente de contenido Empliados',
  templateId: 'modern',
  cta: {
    headline: 'Agentes de IA para tu operación logística',
    body: 'Descubrí cómo agentes autónomos optimizan centros, flotas y última milla.',
    label: 'Conocé Empliados',
    url: 'https://empliados.net/',
    buttonColor: '#FFFFFF',
    urlInput: false,
    placeholder: 'https://tu-empresa.com',
  },
  distribution: {
    accentColor: '#F97316',
    backgroundColor: '#0B1220',
    fontPrimary: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSecondary: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    visualStyle: 'clean_corporate',
    defaultCta: 'Leer artículo',
    website: 'https://empliados.net',
    socialHandles: { linkedin: 'empleados' },
  },
};

const TONE =
  'Profesional, claro, solo sobre agentes de IA aplicados a logística (centros, flotas, WMS, warehouse, última milla). Nunca RRHH, marketing ni IA genérica.';

async function main() {
  const teo = await prisma.agent.upsert({
    where: { slug: 'teo' },
    update: {},
    create: {
      slug: 'teo',
      name: 'Teo',
      description: 'Agente SEO/AEO — contenido, publicación y refresco',
    },
  });

  const discovery = await prisma.agent.upsert({
    where: { slug: 'discovery' },
    update: {},
    create: {
      slug: 'discovery',
      name: 'Discovery',
      description:
        'Agente de descubrimiento de demanda — keywords, tendencia y briefs para Teo',
    },
  });

  const growth = await prisma.agent.upsert({
    where: { slug: 'growth' },
    update: {},
    create: {
      slug: 'growth',
      name: 'Growth',
      description:
        'Agente de distribución — Creative Engine y canales (LinkedIn). No publica en el sitio.',
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'empleados' },
    update: { name: 'Empliados' },
    create: {
      name: 'Empliados',
      slug: 'empleados',
    },
  });

  await prisma.agentConfig.upsert({
    where: {
      workspaceId_agentId: {
        workspaceId: workspace.id,
        agentId: teo.id,
      },
    },
    update: {
      branding: EMPLEADOS_BRANDING,
      tone: TONE,
      topics: LOGISTICS_TOPICS,
      autoPublish: false,
    },
    create: {
      workspaceId: workspace.id,
      agentId: teo.id,
      tone: TONE,
      topics: LOGISTICS_TOPICS,
      frequency: '2/semana',
      autoPublish: false,
      branding: EMPLEADOS_BRANDING,
    },
  });

  await prisma.agentConfig.upsert({
    where: {
      workspaceId_agentId: {
        workspaceId: workspace.id,
        agentId: discovery.id,
      },
    },
    update: {
      topics: DISCOVERY_SEEDS,
      settings: {
        siteUrl: 'https://empliados.net',
        description:
          'Agentes de IA orientados a logística: centros, flotas, warehouse y última milla',
        market: 'ar',
        languageCode: 'es',
      },
    },
    create: {
      workspaceId: workspace.id,
      agentId: discovery.id,
      frequency: 'on-demand',
      autoPublish: false,
      topics: DISCOVERY_SEEDS,
      settings: {
        siteUrl: 'https://empliados.net',
        description:
          'Agentes de IA orientados a logística: centros, flotas, warehouse y última milla',
        market: 'ar',
        languageCode: 'es',
      },
    },
  });

  await prisma.agentConfig.upsert({
    where: {
      workspaceId_agentId: {
        workspaceId: workspace.id,
        agentId: growth.id,
      },
    },
    update: {
      branding: EMPLEADOS_BRANDING,
    },
    create: {
      workspaceId: workspace.id,
      agentId: growth.id,
      frequency: 'on-publish',
      autoPublish: false,
      branding: EMPLEADOS_BRANDING,
    },
  });

  const passwordHash = await bcrypt.hash('empleados2026', 10);
  await prisma.user.upsert({
    where: { email: 'admin@empleados.net' },
    update: {
      workspaceId: workspace.id,
      name: 'Admin Empliados',
      role: 'admin',
    },
    create: {
      email: 'admin@empleados.net',
      name: 'Admin Empliados',
      passwordHash,
      role: 'admin',
      workspaceId: workspace.id,
    },
  });

  console.log('Seed empleados OK:', {
    workspace: workspace.slug,
    agents: [teo.slug, discovery.slug, growth.slug],
    user: 'admin@empleados.net',
    password: 'empleados2026',
    topics: LOGISTICS_TOPICS,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
