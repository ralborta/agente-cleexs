/**
 * Crea workspace empleados + AgentConfig Teo + user admin.
 * Uso (en API): npx tsx apps/api/scripts/seed-empleados.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const EMPLEADOS_BRANDING = {
  brandName: 'Empleados',
  primaryColor: '#2563EB',
  secondaryColor: '#1D4ED8',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  authorLine: 'Por Teo · Agente de contenido Empleados',
  templateId: 'editorial',
  cta: {
    headline: 'Encontrá y retené mejor talento',
    body: 'Pegá la URL de tu sitio y descubrí cómo potenciar tu marca empleadora.',
    label: 'Empezá gratis',
    url: 'https://empliados.net/',
    buttonColor: '#FFFFFF',
    urlInput: false,
    placeholder: 'https://tu-empresa.com',
  },
};

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

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'empleados' },
    update: { name: 'Empleados' },
    create: {
      name: 'Empleados',
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
      tone: 'Profesional, claro, orientado a empresas que buscan y retienen talento',
      topics: [
        'marca empleadora',
        'atracción de talento',
        'visibilidad en IA',
        'SEO para HR',
      ],
      autoPublish: false,
    },
    create: {
      workspaceId: workspace.id,
      agentId: teo.id,
      tone: 'Profesional, claro, orientado a empresas que buscan y retienen talento',
      topics: [
        'marca empleadora',
        'atracción de talento',
        'visibilidad en IA',
        'SEO para HR',
      ],
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
      topics: [
        'marca empleadora',
        'atracción de talento',
        'employer branding',
        'reclutamiento con IA',
      ],
      settings: {
        siteUrl: 'https://empliados.net',
        description: 'Plataforma de marca empleadora y atracción de talento',
        market: 'ar',
        languageCode: 'es',
      },
    },
    create: {
      workspaceId: workspace.id,
      agentId: discovery.id,
      frequency: 'on-demand',
      autoPublish: false,
      topics: [
        'marca empleadora',
        'atracción de talento',
        'employer branding',
        'reclutamiento con IA',
      ],
      settings: {
        siteUrl: 'https://empliados.net',
        description: 'Plataforma de marca empleadora y atracción de talento',
        market: 'ar',
        languageCode: 'es',
      },
    },
  });

  const passwordHash = await bcrypt.hash('empleados2026', 10);
  await prisma.user.upsert({
    where: { email: 'admin@empleados.net' },
    update: {
      workspaceId: workspace.id,
      name: 'Admin Empleados',
      role: 'admin',
    },
    create: {
      email: 'admin@empleados.net',
      name: 'Admin Empleados',
      passwordHash,
      role: 'admin',
      workspaceId: workspace.id,
    },
  });

  console.log('Seed empleados OK:', {
    workspace: workspace.slug,
    agents: [teo.slug, discovery.slug],
    user: 'admin@empleados.net',
    password: 'empleados2026',
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
