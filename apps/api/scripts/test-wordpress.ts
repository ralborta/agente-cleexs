/**
 * Test local de integración WordPress REST (sin deploy, sin DB).
 * Uso: desde raíz del monorepo con .env cargado:
 *   set -a && source .env && set +a && npx tsx apps/api/scripts/test-wordpress.ts
 */
import {
  createWordPressPost,
  isWordPressConfigured,
  markdownToHtml,
  resolveWordPressConfig,
  testWordPressConnection,
} from '../src/lib/integrations/wordpress';

async function main() {
  const config = resolveWordPressConfig('cleexs');
  if (!isWordPressConfigured(config)) {
    console.error('❌ WordPress no configurado. Revisá WORDPRESS_URL, USERNAME, APP_PASSWORD en .env');
    process.exit(1);
  }

  console.log('1/3 Probando conexión...');
  const conn = await testWordPressConnection(config);
  console.log('✅ Conexión OK:', conn.site, '—', conn.user);

  const title = `[Teo API] Test REST ${new Date().toISOString().slice(0, 16)}`;
  const markdown = `# Test integración API\n\nBorrador creado por el backend Agente_Cleexs (REST directo, no MCP).\n\n## Siguiente paso\nAprobar piezas desde /api/approvals → publicar en cleexs.net.`;

  console.log('2/3 Creando borrador...');
  const post = await createWordPressPost(config, {
    title,
    content: markdownToHtml(markdown),
    excerpt: 'Test REST — plataforma Agentes Cleexs',
    status: 'draft',
  });

  console.log('3/3 Borrador creado');
  console.log({
    id: post.id,
    status: post.status,
    link: post.link,
    edit: `https://cleexs.net/wp-admin/post.php?post=${post.id}&action=edit`,
  });
}

main().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
