# WordPress — setup cleexs.net para Teo

Checklist para que los artículos generados por Teo se vean bien e indexen correctamente.

## 1. Enlaces permanentes

WP Admin → **Ajustes → Enlaces permanentes**

- Estructura personalizada: `/articulos/%postname%/`
- Guardar cambios

Teo ya genera URLs canónicas con `https://cleexs.net/articulos/{slug}/`.

## 2. Categoría

- Crear categoría **Artículos** (slug `articulos` o `articulos-teo`)
- En Easypanel API: `WORDPRESS_CATEGORY_ID=<id>`

La API también puede crearla automáticamente al publicar si falta.

## 3. CSS de artículos

Copiar el contenido de [`cleexs-article.css`](./cleexs-article.css) en:

- **Apariencia → Personalizar → CSS adicional**, o
- El stylesheet del tema hijo

Los artículos de Teo incluyen la clase `.cleexs-article` en el HTML.

## 4. Plugin SEO (Rank Math — recomendado)

Rank Math **no expone meta SEO por REST API por defecto**. Hacé estos 3 pasos:

### Paso A — Instalar Rank Math en WordPress

1. WP Admin → **Plugins → Añadir nuevo**
2. Buscar **Rank Math SEO** → Instalar → Activar
3. Completar el asistente (modo **Advanced** recomendado)
4. Opcional: Rank Math SEO → General → Others → **Headless CMS Support** (solo lectura; no alcanza para escribir meta)

### Paso B — Puente REST (obligatorio para Teo)

Teo envía título SEO, meta description y focus keyword al publicar. WordPress bloquea esos campos hasta que los registres.

**Copiá este archivo del repo:**

`docs/wordpress/cleexs-teo-rankmath-rest.php`

**En SiteGround (cleexs.net):**

1. Entrá a **Site Tools** → **Site** → **File Manager**
2. Abrí `public_html/wp-content/`
3. Creá la carpeta `mu-plugins` si no existe (clic derecho → New Folder)
4. Subí el archivo como `cleexs-teo-rankmath-rest.php`

Ruta final:

```
public_html/wp-content/mu-plugins/cleexs-teo-rankmath-rest.php
```

Los mu-plugins se activan solos (no aparecen en Plugins).

**Alternativa:** SFTP con las credenciales de Site Tools → **Site** → **FTP Accounts**.

### Paso C — Variable en Easypanel API

```env
WORDPRESS_SEO_PLUGIN=rankmath
```

Redeploy del servicio **api** tras guardar.

### Verificación

1. Publicá o aprobá un artículo desde Teo
2. En WP Admin → editá el post → panel Rank Math: deberías ver título SEO, description y keyword rellenados
3. Integraciones → Checklist WordPress → item Plugin SEO en verde

### Alternativa: Yoast

Si preferís Yoast: `WORDPRESS_SEO_PLUGIN=yoast` (Yoast registra meta REST en versiones recientes; probá sin mu-plugin).

## 4b. llms.txt (AEO)

1. Copiá `docs/wordpress/cleexs-teo-llms-txt.php` a `mu-plugins/cleexs-teo-llms-txt.php`
2. En el backoffice → Integraciones → **Fundaciones SEO** → **Publicar llms.txt**
3. WP Admin → Ajustes → Enlaces permanentes → Guardar (flush rewrite)
4. Verificá `https://cleexs.net/llms.txt` (texto plano, no HTML)

Teo **no** sobrescribe `robots.txt`. El sitemap lo sirve WordPress/Rank Math; la auditoría solo verifica.

## 5. Usuario Application Password

- WP Admin → Usuarios → tu usuario → **Contraseñas de aplicación**
- Rol mínimo: **Editor** (para publicar y meta SEO)

## Verificación desde el backoffice

Integraciones → sección WordPress → **Checklist WordPress**  
(o `GET /api/integrations/cleexs/wordpress/setup`)

## Variables API (Easypanel)

```env
WORDPRESS_URL=https://cleexs.net
WORDPRESS_USERNAME=...
WORDPRESS_APP_PASSWORD=...
WORDPRESS_CATEGORY_ID=18
WORDPRESS_SEO_PLUGIN=rankmath
WORDPRESS_APPROVAL_STATUS=draft
```

Con `autoPublish=true` en Config Teo, las piezas se publican directo en WP con status `publish`.
