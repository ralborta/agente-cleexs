# Flujo completo — Plataforma Agentes Cleexs (Teo)

**Documento:** Flujo operativo, publicación y backoffice  
**Producto:** Centro de Gestión de Agentes Cleexs  
**Primer agente:** Teo (SEO / AEO / contenido)  
**Primer cliente (workspace):** Cleexs  
**Fecha:** Julio 2026  
**Versión:** 1.0 — MVP

---

## 1. Visión general

La plataforma **Agentes Cleexs** es un sistema multiagente **separado del producto PRIA** (app.cleexs.net). Cleexs es el primer *workspace*; Teo es el primer *agente*.

| Producto | Rol |
|----------|-----|
| **Cleexs (PRIA)** | Mide y diagnostica visibilidad |
| **Plataforma Agentes Cleexs** | Produce, publica y mantiene contenido |
| **cleexs.net (WordPress)** | Sitio público donde vive el blog / artículos |
| **Centro de Gestión (backoffice)** | El cliente configura poco y **mide resultados** |

**Principio rector:** el agente trabaja **de forma autónoma**. El cliente configura temas y reglas al inicio; el backoffice sirve principalmente para **ver resultados** y, cuando corresponde, **aprobar** piezas puntuales.

**No se usa:** n8n, LangChain (fase inicial), vocabulario PRIA (runs, diagnósticos).

---

## 2. Arquitectura de la plataforma

### 2.1 Componentes

| Componente | Tecnología | Función |
|------------|------------|---------|
| Backoffice | Next.js | Centro de Gestión de Agentes Cleexs — UI del cliente |
| API | Fastify + Prisma | Auth, datos, orquestación, integraciones |
| PostgreSQL | Base de datos | Misiones, piezas, aprobaciones, métricas |
| mission-executor | Lógica en API | Ejecuta pasos de Teo en secuencia |
| job-scheduler | Cron interno en API | Dispara misiones autónomas periódicamente |
| WordPress REST | cleexs.net | Publicación de artículos |
| GA4 + GSC | Google APIs (fase 2) | Medición de resultados por URL |

### 2.2 Despliegue previsto

| Servicio | Hosting sugerido |
|----------|------------------|
| API + PostgreSQL + Backoffice | Easypanel (todo en un panel) |
| cleexs.net | Hostinger (WordPress + Elementor) |
| app.cleexs.net (PRIA) | Producto aparte — no forma parte de esta plataforma |

### 2.3 Dominios sugeridos

- **agents.cleexs.net** → Backoffice (Centro de Gestión)
- **api-agents.cleexs.net** → API de la plataforma
- **cleexs.net/articulos/** → Artículos publicados por Teo

---

## 3. Vocabulario de la plataforma (agente, no PRIA)

| Término | Significado |
|---------|-------------|
| **Workspace** | Cliente de la plataforma (ej. Cleexs, Empleados) |
| **Agente** | Módulo de capacidad (ej. Teo; futuros agentes 2, 3…) |
| **Misión** | Una ejecución concreta del agente (NO “run”) |
| **Pieza** | Contenido generado: FAQ, comparativa, checklist, pilar, etc. |
| **Ecosistema** | Cluster de contenido: pieza pilar + satélites |
| **Aprobación** | Revisión humana antes de publicar (human-in-the-loop) |
| **Publicación** | Pieza enviada a WordPress |
| **Actividad** | Log de lo que hace el agente (feed en tiempo real) |
| **Resultados** | Métricas GSC, GA4, impresiones, tráfico por URL |

---

## 4. Roles internos de Teo (dentro de una misión)

Teo no es la plataforma: es el **primer agente**. Sus roles internos son **pasos del pipeline**, no agentes separados de plataforma.

| Rol | Función | Entrada | Salida |
|-----|---------|---------|--------|
| **Estratega** | Decide qué pieza crear | Temas config + métricas | Plan (tipo, keyword, título) |
| **Analítico** | Lee GSC/GA4 (fase 2) | Datos por URL | Oportunidades y refrescos |
| **Researcher** | Investiga el tema | Plan | Outline + fuentes |
| **Periodista** | Obtiene datos reales (fase 2) | Empleados del cliente | Quotes, casos, cifras |
| **Escritor** | Redacta el contenido | Outline + datos | Borrador |
| **Albañil SEO** | SEO técnico | Borrador | Schema, OG, canonical, interlinks |
| **Publicador** | Envía a WordPress | Pieza aprobada | Post en WP |
| **Refrescador** | Detecta contenido viejo | Métricas + antigüedad | Propuesta de actualización |
| **Contactador** | Outreach asistido (fase 2) | Fuentes citadas por IA | Borradores de contacto |

---

## 5. Flujo automático completo

### 5.1 Diagrama de flujo

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FASE A — CONFIGURACIÓN (poco, al inicio o cuando cambia la estrategia)   │
├─────────────────────────────────────────────────────────────────────────┤
│  • Temas / keywords prioritarios                                         │
│  • Tono de voz y entidad (marca, productos)                              │
│  • Tipos de pieza permitidos (FAQ, comparativa, checklist…)              │
│  • Frecuencia (ej. 2 piezas por semana)                                  │
│  • Integraciones: WordPress, GA4, GSC                                    │
│  • Regla de publicación: ¿requiere aprobación humana? (sí en MVP)        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ FASE B — TEO AUTÓNOMO (sin intervención del cliente)                     │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Scheduler (cron interno) revisa workspaces con temas configurados    │
│  2. Si no hay misión activa y pasó el intervalo mínimo → crea misión      │
│  3. Estratega elige tema + tipo de pieza                                 │
│  4. Researcher genera outline + fuentes                                  │
│  5. Escritor genera borrador                                             │
│  6. Albañil SEO aplica schema, meta, slug, links internos                │
│  7. Se crea ContentPiece en base de datos                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
         autoPublish = false              autoPublish = true
                    │                               │
                    ▼                               ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│ FASE C — APROBACIÓN (opcional)│    │ Publicación directa en WP    │
│  • Pieza en cola backoffice  │    │ (solo clientes maduros)      │
│  • Cliente revisa / edita    │    └──────────────────────────────┘
│  • Aprueba o rechaza         │
└──────────────────────────────┘
                    │ aprueba
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ FASE D — PUBLICACIÓN EN WORDPRESS                                        │
├─────────────────────────────────────────────────────────────────────────┤
│  • API REST → wp_create_post (draft o publish según config)              │
│  • Guarda externalId (ID post WP) y URL en Publication                   │
│  • Registra actividad: "Publicada en WordPress"                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ FASE E — MEDICIÓN Y REFRESCO (continuo)                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  • Sync GSC/GA4 por URL (cron diario)                                    │
│  • Dashboard de Resultados en backoffice                                 │
│  • Si pieza envejece o cae rendimiento → Refrescador propone update      │
│  • Nueva misión de refresco → vuelve a Fase B                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Quién decide qué publicar

**Hoy (MVP):**
- Rota entre los **temas configurados** en AgentConfig
- Alterna **tipos de pieza** (FAQ, comparativa, checklist, how-to, pilar)
- Intervalo mínimo entre misiones: ~3 días por workspace

**Fase 2 (con GSC/GA4 conectado):**
- Prioriza URLs con **caída de impresiones**
- Detecta **gaps de contenido** vs competencia
- **Refresca** piezas viejas automáticamente

El cliente **no elige cada artículo**. Define el **territorio** (temas); Teo opera dentro de eso.

### 5.3 Tres modos de publicación

| Modo | Comportamiento | Cuándo usar |
|------|----------------|-------------|
| **1. Con aprobación** (default MVP) | Teo genera → cola en backoffice → cliente aprueba → publica en WP | Cleexs piloto, construir confianza |
| **2. Autopublicar borrador** | Teo deja draft en WP; cliente revisa en admin WP | Transición |
| **3. Autopublicar directo** | status=publish sin humano | Solo cuando el contenido es confiable |

Variable de entorno: `WORDPRESS_APPROVAL_STATUS=draft` o `publish`

---

## 6. Flujo del cliente (experiencia en el backoffice)

### 6.1 Proporción del producto

| Uso del backoffice | % estimado |
|--------------------|------------|
| Medición de resultados (impresiones, tráfico, piezas) | 80% |
| Transparencia (actividad de Teo) | 15% |
| Configuración + aprobaciones puntuales | 5% |

### 6.2 Navegación del Centro de Gestión

**Resultados (prioridad):**
- Centro de gestión (dashboard KPIs)
- Resultados (GSC + GA4 por URL)
- Publicaciones (lo publicado en WP)
- Actividad (feed de Teo)

**Excepciones:**
- Aprobaciones (solo si hay pendientes — badge)
- Misiones (monitor de ejecuciones)

**Configuración (al final, se toca poco):**
- Temas y reglas Teo
- Integraciones (WP, GA4, GSC)

### 6.3 Ciclo típico del cliente

1. Configura temas e integraciones (una vez)
2. Teo trabaja solo en segundo plano
3. Cliente entra 1–2 veces por semana al backoffice
4. Mira **Resultados**: ¿suben impresiones? ¿hay tráfico?
5. Si hay aprobación pendiente → revisa en 2 minutos y aprueba
6. Listo — Teo sigue solo

---

## 7. Flujo técnico: misión → WordPress

### 7.1 Creación de misión

**Trigger manual:**
```
POST /api/missions
Body: { "workspaceSlug": "cleexs", "autoExecute": true }
```

**Trigger automático:**
```
Scheduler interno → tickAutonomousMissions()
Condiciones: temas configurados, sin misión activa, intervalo cumplido
```

### 7.2 Ejecución (mission-executor)

Secuencia fija:
1. strategist → plan
2. researcher → outline
3. writer → borrador markdown/HTML
4. seo_builder → meta + schema + slug
5. Crear ContentPiece (status: pending_approval)
6. Crear Approval (status: pending) si autoPublish=false
7. Misión → completed
8. Registrar AgentActivity en cada paso

### 7.3 Aprobación y publicación

```
POST /api/approvals/:id/approve
  → publishPieceToWordPress()
  → WordPress REST POST /wp-json/wp/v2/posts
  → Actualizar ContentPiece (published)
  → Crear/actualizar Publication (externalId, url)
  → Log actividad
```

**Si WordPress falla:** no se aprueba en DB (error 502).

### 7.4 Endpoints API principales

| Método | Ruta | Función |
|--------|------|---------|
| GET | /api/centro/:workspace | Dashboard KPIs + actividad |
| GET | /api/results/:workspace | Métricas y resumen |
| GET/PATCH | /api/config/:workspace/agents/teo | Configuración Teo |
| GET | /api/approvals?workspace=cleexs | Cola de aprobación |
| POST | /api/approvals/:id/approve | Aprobar y publicar en WP |
| POST | /api/approvals/:id/reject | Rechazar pieza |
| POST | /api/missions | Crear y ejecutar misión |
| GET | /api/content/pieces | Listar piezas |
| POST | /api/integrations/:workspace/wordpress/test | Probar conexión WP |
| POST | /api/cron/autonomous-tick | Forzar tick del scheduler |

---

## 8. Integración WordPress

### 8.1 Método

- **REST API** con Application Password (mismo mecanismo que MCP en Cursor)
- La API en producción **no usa MCP** — MCP es solo para desarrollo en Cursor
- Variables: WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD

### 8.2 Estado actual (probado)

- Conexión a cleexs.net: OK
- Creación de borradores vía API: OK (posts de prueba #371, #372)
- SEO plugin (Yoast/RankMath): no instalado aún — meta manual o instalar plugin

### 8.3 Mejoras de diseño previstas para artículos

| Prioridad | Acción |
|-----------|--------|
| Alta | Categoría "Artículos" + permalink /articulos/%postname%/ |
| Alta | Plantillas HTML por tipo de pieza (FAQ, checklist, comparativa) |
| Alta | CSS Cleexs en tema hijo (.cleexs-article) |
| Media | Plugin SEO (RankMath/Yoast) para meta y schema vía API |
| Baja | Plantillas Elementor por artículo (no recomendado al inicio) |

**Principio:** Google y las IA necesitan contenido **estructurado e indexable**, no diseño pesado por pieza.

---

## 9. Tipos de pieza y ecosistemas

### 9.1 Tipos soportados (MVP y roadmap)

FAQ, definición, glosario, checklist, comparativa, how-to, pilar, caso de estudio, calculadora, landing, y otros.

### 9.2 Ecosistema piloto sugerido (Cleexs)

**Pilar:** Guía completa — Visibilidad en IA / AEO

**Satélites:**
- FAQ: ¿Qué es la visibilidad en IA?
- Checklist: Cómo auditar tu sitio para IA
- Comparativa: Cleexs vs alternativas
- How-to: Cómo mejorar tu presencia en ChatGPT

Cada pieza tiene intención distinta; se interlinkean entre sí y al pilar.

---

## 10. Modelo de datos (resumen)

| Entidad | Descripción |
|---------|-------------|
| Workspace | Cliente (Cleexs) |
| Agent | Catálogo de agentes (teo) |
| AgentConfig | Temas, tono, frecuencia, autoPublish |
| Mission | Ejecución del agente |
| MissionStep | Paso individual (strategist, writer, etc.) |
| ContentPiece | Pieza generada |
| ContentCluster | Ecosistema pilar + satélites |
| Approval | Cola human-in-the-loop |
| Publication | Registro en WordPress (externalId, url) |
| AgentActivity | Feed de actividad |
| MetricSnapshot | GSC/GA4 por URL |
| Integration | WP, GA4, GSC por workspace |

---

## 11. Roadmap por fases

### Fase 1 — MVP (actual)
- [x] Monorepo Agente_Cleexs
- [x] API Fastify + Prisma
- [x] mission-executor + scheduler autónomo
- [x] Integración WordPress REST
- [x] Backoffice Centro de Gestión (UI)
- [ ] PostgreSQL local / Easypanel
- [ ] Flujo completo misión → aprobación → WP
- [ ] Primer ecosistema real en cleexs.net

### Fase 2 — Contenido y métricas
- Plantillas HTML por tipo de pieza
- Categoría y permalinks /articulos/
- Sync GSC + GA4
- Pantalla Resultados con datos reales
- Refrescador automático

### Fase 3 — Escala
- Segundo workspace (Empleados)
- Periodista (datos de empleados)
- Contactador asistido
- Evaluar LangChain si el pipeline se vuelve dinámico
- Segundo agente en la plataforma

---

## 12. Lo que NO es parte de este flujo

- Producto PRIA (runs, diagnósticos, prompts)
- n8n
- LangChain (fase inicial)
- MCP WordPress en producción (solo dev)
- Admin interno de Cleexs
- Publicación 100% automática sin aprobación (en piloto)

---

## 13. Resumen ejecutivo

> El cliente **configura temas y reglas una vez**. **Teo trabaja solo**: planifica, investiga, escribe, optimiza SEO y deja la pieza lista. Si está activada la aprobación humana, el cliente **revisa en minutos** y al aprobar se **publica en WordPress**. El backoffice sirve **principalmente para medir resultados** (impresiones, tráfico, piezas publicadas). Cleexs es el primer caso de éxito; la plataforma está diseñada para **múltiples agentes y múltiples clientes** en el futuro.

---

*Documento generado para Agente_Cleexs — Plataforma multiagente*
