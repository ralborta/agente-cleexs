# Onboarding Empliados.net (Teo multi-workspace)

**Producto:** agentes de IA orientados a **logística** (centros, flotas, warehouse). No es RRHH ni marca empleadora.

## Estado

- Workspace DB `empleados` + AgentConfig Teo + user `admin@empleados.net`
- Portal multi-tenant: `/{workspace}/...` (ej. `/empleados`, `/cleexs`)
- Canonicals / interlinks usan la URL WP del workspace (`WP_EMPLEADOS_*` o fallback `empliados.net`)
- Env: `WP_EMPLEADOS_URL/USER/APP_PASSWORD` cargados en API (SiteGround)

## Pendiente (vos)

1. ~~Credenciales WordPress~~ → `teo` en https://empliados.net (revisar categoría Artículos)
   - `WP_EMPLEADOS_CATEGORY_ID` (opcional, si existe categoría blog)
2. GSC + GA4 de empleados.net + service account
3. IndexNow key propia del site
4. Permalink WP `/articulos/%postname%/`
5. Rank Math + Application Password + usuario Teo

## Login portal

- Cleexs: `admin@cleexs.net` (password actual)
- Empleados: `admin@empleados.net` / `empleados2026` (cambiar en producción)

Tras login, el portal abre `/{workspaceSlug}/`.

## Seed (API)

```bash
npx tsx apps/api/scripts/seed-empleados.ts
```
