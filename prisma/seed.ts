import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_BRAND_KIT } from '@agente/shared';

const prisma = new PrismaClient();

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

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'cleexs' },
    update: {},
    create: {
      name: 'Cleexs',
      slug: 'cleexs',
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
      branding: DEFAULT_BRAND_KIT,
    },
    create: {
      workspaceId: workspace.id,
      agentId: teo.id,
      tone: 'Profesional, claro, orientado a PyMEs latinoamericanas',
      topics: ['visibilidad en IA', 'SEO', 'AEO', 'diagnóstico de marca'],
      frequency: '2/semana',
      autoPublish: false,
      branding: DEFAULT_BRAND_KIT,
    },
  });

  const passwordHash = await bcrypt.hash('demo1234', 10);
  await prisma.user.upsert({
    where: { email: 'admin@cleexs.net' },
    update: {},
    create: {
      email: 'admin@cleexs.net',
      name: 'Administrador',
      passwordHash,
      role: 'admin',
      workspaceId: workspace.id,
    },
  });

  const activities = [
  { role: 'writer' as const, message: 'Borrador "FAQ visibilidad en IA" listo para revisión' },
  { role: 'seo_builder' as const, message: 'Schema + Open Graph aplicados a comparativa Cleexs' },
  { role: 'strategist' as const, message: 'Nuevo ecosistema planificado: Visibilidad AEO' },
  { role: 'publisher' as const, message: '"Checklist AEO" publicado en cleexs.net/articulos' },
  ];

  for (const activity of activities) {
    await prisma.agentActivity.create({
      data: {
        workspaceId: workspace.id,
        agentId: teo.id,
        role: activity.role,
        level: 'info',
        message: activity.message,
      },
    });
  }

  console.log('Seed OK:', { workspace: workspace.slug, agent: teo.slug });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
