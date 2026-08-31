# Guía rápida — Indexación automática (Cleexs / Teo)

**Sitio:** cleexs.net  
**Duración:** ~3 minutos  
**Para qué:** que Teo pueda avisar a Google cuando publica o actualiza un artículo.

---

## Qué tenés que hacer

En Google Search Console, dar permiso de **Propietario** a la cuenta técnica de Teo.

### Pasos

1. Entrá a [Google Search Console](https://search.google.com/search-console)
2. Seleccioná la propiedad de **cleexs.net**  
   (si ves varias, elegí la del dominio o la URL del sitio)
3. En el menú izquierdo: **Configuración** (ícono de engranaje)
4. Abrí **Usuarios y permisos**
5. Tocá **Agregar usuario**
6. Pegá exactamente este email:

```
agente-teo-metrics@gen-lang-client-0925506379.iam.gserviceaccount.com
```

7. En permiso, elegí **Propietario** (no “Usuario completo”)
8. Guardá / confirmar

### Cómo saber que quedó bien

- En **Usuarios y permisos** debería aparecer ese email como **Propietario**.
- Avisanos cuando esté listo: nosotros disparamos un submit de prueba y te confirmamos.

### Importante

- **No hace falta** compartir contraseñas ni claves.
- Solo se agrega ese email de servicio (es de Google Cloud, no es una persona).
- Sin este permiso, Teo puede medir Search Console, pero **no** puede pedir indexación automática a Google.

---

## (Opcional, lo hacemos nosotros en Hostinger)

Si te pedimos solo el paso de Search Console, el archivo IndexNow en el hosting lo gestiona el equipo técnico en cleexs.net. No tenés que tocar Hostinger para este permiso de Google.
