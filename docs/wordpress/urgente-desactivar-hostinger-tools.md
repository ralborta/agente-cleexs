# Urgente: desactivar Hostinger Tools (rompe REST / wp-admin)

Al activar el plugin **Hostinger Tools** para intentar purgar caché:

- `/wp-json/` redirige a `/wp-admin/`
- `/wp-admin/` responde **403**
- El artículo puede seguir sirviendo HTML viejo desde caché LiteSpeed/Hostinger

## Arreglo (File Manager de Hostinger)

1. Entrá a **hPanel → Archivos → Administrador de archivos**
2. Andá a `public_html/wp-content/plugins/`
3. Renombrá la carpeta `hostinger` → `hostinger-disabled`
4. En hPanel: **Sitios web → cleexs.net → Caché → Borrar todo / Purge All**
5. En WordPress (cuando vuelva): barra superior **LiteSpeed Cache → Purge All**
6. Abrí de nuevo: https://cleexs.net/articulos/checklist-seo/

El contenido nuevo (foto de Teo, contraste, ancho) **ya está guardado en la base** del post 411; solo faltaba que la caché sirva esa versión.
