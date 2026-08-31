import {
  auditWordPressHeaderIdentity,
  findOrCreateCategory,
  isWordPressConfigured,
  resolveWordPressConfig,
  testWordPressConnection,
} from './wordpress';
import { resolveSeoPlugin, resolveHeaderSiteName, WP_HEADER_HOME_NAV_TITLE } from './wordpress-seo';

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

const RANK_MATH_REST_KEYS = [
  'rank_math_title',
  'rank_math_description',
  'rank_math_focus_keyword',
] as const;

/** Verifica que el mu-plugin exponga campos Rank Math en REST (context=edit). */
async function checkRankMathRestBridge(
  config: { baseUrl: string; username: string; appPassword: string },
): Promise<boolean> {
  const res = await wpFetchRaw(config, '/posts?context=edit&per_page=1&status=any');
  if (!res.ok) return false;

  const posts = (await res.json()) as Array<{ meta?: Record<string, unknown> }>;
  const meta = posts[0]?.meta;
  if (meta && RANK_MATH_REST_KEYS.every((key) => key in meta)) {
    return true;
  }

  const schemaRes = await fetch(`${config.baseUrl}/wp-json/wp/v2/posts`, {
    method: 'OPTIONS',
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${config.username}:${config.appPassword.replace(/\s/g, '')}`,
      ).toString('base64')}`,
      Accept: 'application/json',
    },
  });
  if (!schemaRes.ok) return false;

  const schema = (await schemaRes.json()) as {
    schema?: { properties?: { meta?: { properties?: Record<string, unknown> } } };
  };
  const metaProps = schema.schema?.properties?.meta?.properties;
  return Boolean(metaProps && RANK_MATH_REST_KEYS.every((key) => key in metaProps));
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
    label: 'Plugin SEO (Rank Math / Yoast)',
    status: seoPlugin ? 'ok' : 'pending',
    detail: seoPlugin
      ? `API configurada: ${seoPlugin}. Instalá el plugin en WP + mu-plugin cleexs-teo-rankmath-rest.php`
      : 'Definí WORDPRESS_SEO_PLUGIN=rankmath en Easypanel API',
  });

  try {
    const header = await auditWordPressHeaderIdentity(config!, {
      siteName: resolveHeaderSiteName(workspaceSlug),
      homeNavTitle: WP_HEADER_HOME_NAV_TITLE,
    });
    checks.push({
      id: 'header_identity',
      label: 'Header (título del sitio / Inicio)',
      status: header.ok ? 'ok' : 'warning',
      detail: header.detail,
    });
  } catch (err) {
    checks.push({
      id: 'header_identity',
      label: 'Header (título del sitio / Inicio)',
      status: 'warning',
      detail: err instanceof Error ? err.message : 'No se pudo verificar el header de Astra',
    });
  }

  if (seoPlugin === 'rankmath') {
    try {
      const bridgeOk = await checkRankMathRestBridge(config!);
      checks.push({
        id: 'seo_rest_bridge',
        label: 'Puente REST Rank Math (mu-plugin)',
        status: bridgeOk ? 'ok' : 'pending',
        detail: bridgeOk
          ? 'Meta SEO expuesta vía REST (rank_math_title, rank_math_description, rank_math_focus_keyword)'
          : 'Subí docs/wordpress/cleexs-teo-rankmath-rest.php a public_html/wp-content/mu-plugins/ en SiteGround (Site Tools → File Manager)',
      });
    } catch {
      checks.push({
        id: 'seo_rest_bridge',
        label: 'Puente REST Rank Math (mu-plugin)',
        status: 'pending',
        detail:
          'No se pudo verificar el puente REST — confirmá que cleexs-teo-rankmath-rest.php está en wp-content/mu-plugins/',
      });
    }
  } else if (seoPlugin === 'yoast') {
    checks.push({
      id: 'seo_rest_bridge',
      label: 'Meta SEO vía REST (Yoast)',
      status: 'ok',
      detail: 'Yoast expone meta SEO por REST en versiones recientes',
    });
  }

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
