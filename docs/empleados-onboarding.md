# Onboarding Empleados.net (Teo multi-workspace)

## Estado

- Workspace DB `empleados` + AgentConfig Teo + user `admin@empleados.net`
- Portal multi-tenant: `/{workspace}/...` (ej. `/empleados`, `/cleexs`)
- Canonicals / interlinks usan la URL WP del workspace (`WP_EMPLEADOS_*` o fallback `empleados.net`)
- Env listos: `WP_EMPLEADOS_*`, `GSC_EMPLEADOS_*`, `GA4_EMPLEADOS_*`, `INDEXNOW_EMPLEADOS_*`

## Pendiente (vos)

1. Pasar credenciales WordPress de empleados.net:
   - `WP_EMPLEADOS_URL`
   - `WP_EMPLEADOS_USER`
   - `WP_EMPLEADOS_APP_PASSWORD`
   - `WP_EMPLEADOS_CATEGORY_ID` (opcional)
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
