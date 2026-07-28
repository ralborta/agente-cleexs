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

## 4. Plugin SEO (Rank Math recomendado)

1. Instalar **Rank Math SEO** (o Yoast)
2. En Easypanel API agregar: `WORDPRESS_SEO_PLUGIN=rankmath`
3. El usuario de Application Password debe ser **Editor** o **Administrador**

Teo envía título SEO, meta description y focus keyword vía REST al publicar.

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
