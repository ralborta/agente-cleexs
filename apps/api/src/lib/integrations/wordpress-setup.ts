import {
  findOrCreateCategory,
  isWordPressConfigured,
  resolveWordPressConfig,
  testWordPressConnection,
} from './wordpress';
import { resolveSeoPlugin } from './wordpress-seo';

export type WordPressSetupCheck = {
  id: string;
  label: string;
  status: 'ok' | 'warning' | 'pending';
  detail: string;
};

export type WordPressSetupReport = {
  configured: boolean;
  checks: WordPressSetupCheck[];
  cssSnippetPath: string;
  manualSteps: string[];
};

const DEFAULT_CATEGORY = 'Artículos';

async function wpFetchRaw(
  config: { baseUrl: string; username: string; appPassword: string },
  path: string,
): Promise<Response> {
  const token = Buffer.from(
    `${config.username}:${config.appPassword.replace(/\s/g, '')}`,
  ).toString('base64');
  return fetch(`${config.baseUrl}/wp-json/wp/v2${path}`, {
    headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
  });
}

export async function auditWordPressSetup(workspaceSlug: string): Promise<WordPressSetupReport> {
  const config = resolveWordPressConfig(workspaceSlug);
  const cssSnippetPath = 'docs/wordpress/cleexs-article.css';

  const manualSteps = [
    'En WP Admin → Ajustes → Enlaces permanentes: estructura personalizada `/articulos/%postname%/`',
    'Instalar Rank Math SEO (o Yoast) y definir `WORDPRESS_SEO_PLUGIN=rankmath` en la API',
    `Pegar CSS de \`${cssSnippetPath}\` en Apariencia → Personalizar → CSS adicional (o tema hijo)`,
    'Verificar que el usuario de Application Password tenga rol Editor o Administrador',
  ];

  if (!isWordPressConfigured(config)) {
    return {
      configured: false,
      checks: [
        {
          id: 'credentials',
          label: 'Credenciales WordPress',
          status: 'pending',
          detail: 'WORDPRESS_URL, WORDPRESS_USERNAME y WORDPRESS_APP_PASSWORD no configurados',
        },
      ],
      cssSnippetPath,
      manualSteps,
    };
  }

  const checks: WordPressSetupCheck[] = [];

  try {
    const conn = await testWordPressConnection(config!);
    const roles = conn.roles ?? [];
    checks.push({
      id: 'connection',
      label: 'Conexión REST API',
      status: 'ok',
      detail: `Conectado como ${conn.user} (${roles.join(', ') || 'sin roles'})`,
    });

    if (!roles.includes('administrator') && !roles.includes('editor')) {
      checks.push({
        id: 'permissions',
        label: 'Permisos del usuario',
        status: 'warning',
        detail: 'Se recomienda rol Editor o Administrador para publicar y meta SEO',
      });
    } else {
      checks.push({
        id: 'permissions',
        label: 'Permisos del usuario',
        status: 'ok',
        detail: `Rol adecuado: ${roles.join(', ')}`,
      });
    }
  } catch (err) {
    checks.push({
      id: 'connection',
      label: 'Conexión REST API',
      status: 'warning',
      detail: err instanceof Error ? err.message : 'Error de conexión',
    });
  }

  try {
    const categoryId = config!.defaultCategoryId ?? (await findOrCreateCategory(config!, DEFAULT_CATEGORY));
    checks.push({
      id: 'category',
      label: `Categoría "${DEFAULT_CATEGORY}"`,
      status: 'ok',
      detail: `ID ${categoryId} — posts de Teo se publican acá`,
    });
  } catch (err) {
    checks.push({
      id: 'category',
      label: `Categoría "${DEFAULT_CATEGORY}"`,
      status: 'warning',
      detail: err instanceof Error ? err.message : 'No se pudo verificar categoría',
    });
  }

  const seoPlugin = resolveSeoPlugin();
  checks.push({
    id: 'seo_plugin',
    label: 'Plugin SEO',
    status: seoPlugin ? 'ok' : 'pending',
    detail: seoPlugin
      ? `Configurado: ${seoPlugin} (WORDPRESS_SEO_PLUGIN)`
      : 'Definí WORDPRESS_SEO_PLUGIN=rankmath|yoast tras instalar el plugin',
  });

  try {
    const res = await wpFetchRaw(config!, '/posts?per_page=5&status=publish&orderby=date&order=desc');
    if (res.ok) {
      const posts = (await res.json()) as Array<{ link?: string; content?: { rendered?: string } }>;
      const articulosOk = posts.some((p) => p.link?.includes('/articulos/'));
      checks.push({
        id: 'permalink',
        label: 'Permalink /articulos/',
        status: articulosOk ? 'ok' : 'pending',
        detail: articulosOk
          ? 'Posts publicados usan /articulos/'
          : 'Ningún post reciente usa /articulos/ — configurar enlaces permanentes en WP',
      });

      const cssOk = posts.some((p) => p.content?.rendered?.includes('cleexs-article'));
      checks.push({
        id: 'article_css',
        label: 'Clase .cleexs-article en contenido',
        status: cssOk ? 'ok' : 'warning',
        detail: cssOk
          ? 'Artículos incluyen la clase cleexs-article'
          : 'Agregar CSS del repo y/o publicar piezas con plantilla Teo',
      });
    }
  } catch {
    checks.push({
      id: 'permalink',
      label: 'Permalink /articulos/',
      status: 'pending',
      detail: 'No se pudo leer posts publicados',
    });
  }

  return { configured: true, checks, cssSnippetPath, manualSteps };
}
