import type { BrandKit } from '@agente/shared';
import { prisma } from '../../../prisma';
import { resolveBrandKit } from '../../../branding/brand-kit';
import { resolveDistributionBrand, type ResolvedDistributionBrand } from './types';

export async function loadGrowthBrand(
  workspaceId: string,
  workspaceSlug: string,
  workspaceName: string,
): Promise<{ kit: BrandKit; distribution: ResolvedDistributionBrand } | null> {
  const growth = await prisma.agent.findUnique({ where: { slug: 'growth' } });
  const teo = await prisma.agent.findUnique({ where: { slug: 'teo' } });

  const growthConfig = growth
    ? await prisma.agentConfig.findUnique({
        where: { workspaceId_agentId: { workspaceId, agentId: growth.id } },
      })
    : null;

  const teoConfig = teo
    ? await prisma.agentConfig.findUnique({
        where: { workspaceId_agentId: { workspaceId, agentId: teo.id } },
      })
    : null;

  // Preferir branding de Growth; si no, heredar Teo + distribution.
  const base = resolveBrandKit(
    growthConfig?.branding ?? teoConfig?.branding,
    workspaceName,
  );

  const distribution = resolveDistributionBrand(workspaceSlug, base);
  if (!distribution) return null;

  // Requisito V1: debe haber kit usable (nombre). Logo opcional → tipográfico.
  return { kit: base, distribution };
}
