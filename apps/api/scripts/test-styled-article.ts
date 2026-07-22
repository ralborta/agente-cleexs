/**
 * Test publicación con plantilla HTML Cleexs (sin DB).
 */
import { runResearcher, runSeoBuilder, runStrategist, runWriter } from '../src/lib/agents/teo/pipeline';
import { createWordPressPost, findOrCreateCategory, pieceContentToHtml, resolveWordPressConfig } from '../src/lib/integrations/wordpress';

async function main() {
  const config = resolveWordPressConfig('cleexs');
  if (!config?.baseUrl) throw new Error('WORDPRESS_* no configurado');

  const plan = runStrategist(
    { topics: ['visibilidad en IA'], tone: 'profesional' },
    0,
  );
  const research = runResearcher(plan);
  const draft = await runWriter(plan, research, 'profesional');
  const seo = runSeoBuilder(plan, draft);

  const categoryId = await findOrCreateCategory(config, 'Artículos');

  const post = await createWordPressPost(config, {
    title: `[Teo] ${plan.title}`,
    content: pieceContentToHtml({ html: draft.html, excerpt: draft.excerpt }),
    excerpt: draft.excerpt,
    slug: seo.slug,
    status: 'draft',
    categories: [categoryId],
  });

  console.log('✅ Artículo con plantilla Cleexs publicado como borrador');
  console.log({ id: post.id, link: post.link, type: plan.pieceType, categoryId });
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
