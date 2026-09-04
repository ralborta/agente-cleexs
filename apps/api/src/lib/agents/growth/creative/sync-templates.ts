import { prisma } from '../../../prisma';
import { CREATIVE_TEMPLATE_CATALOG } from './templates/registry';

let synced = false;

/** Upsert catálogo global (no sobrescribe versiones existentes distintas). */
export async function ensureCreativeTemplatesSynced(): Promise<void> {
  if (synced) return;

  for (const template of CREATIVE_TEMPLATE_CATALOG) {
    await prisma.creativeTemplate.upsert({
      where: {
        templateKey_version: {
          templateKey: template.templateKey,
          version: template.version,
        },
      },
      create: {
        templateKey: template.templateKey,
        version: template.version,
        category: template.category,
        name: template.name,
        config: template as object,
        deprecated: false,
      },
      update: {
        category: template.category,
        name: template.name,
        config: template as object,
      },
    });
  }

  synced = true;
}
