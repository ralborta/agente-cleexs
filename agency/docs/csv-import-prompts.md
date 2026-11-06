# Importación CSV — Prompts propios (Agency)

Portal: `/prompts` en el servicio **agency** (EasyPanel), no el admin `app.cleexs.net`.

## Formato

- Encoding: **UTF-8** (plantilla con BOM para Excel).
- Delimitador: `,` o `;` (auto-detectado en la cabecera).
- Columna obligatoria: `prompt` (también acepta `texto` / `consulta`).
- Columna opcional: `name` / `nombre`.
- Comillas dobles, comas, punto y coma y saltos de línea dentro de campos citados (RFC 4180-ish).

Plantilla descargable desde la UI (**Plantilla CSV**) o fixture de ejemplo:

`src/lib/__fixtures__/prompts-import-sample.csv`

## Comportamiento

1. Vista previa + validación por fila (vacíos, duplicados CSV/existentes, malformados, overflow).
2. Confirmación explícita del usuario.
3. Asignación solo a **slots libres** del proyecto activo (no pisa existentes).
4. Tope combinado: `CUSTOM_PROMPTS_MAX` / `AGENCY_SLOTS` = **40**.
5. Éxito durable solo tras **PUT + GET** a `/api/cleexs/custom-prompts` (Cleexs weekly-prompts). Nunca solo `localStorage`.
6. Carga manual (**Agregar prompt**) se mantiene.

## Durabilidad upstream

Agency admite slots `0..39`. La API Cleexs (`ralborta/cleexs` weekly-prompts) puede reportar `maxSlots` menor (históricamente **5** → `0..4`).

Si `cleexsLiveSlots < 40`, Agency:

- importa solo en slots durables libres;
- marca el resto como `not_durable` / `CRITICAL` en warnings;
- **no afirma** guardado correcto de esos slots.

**Dependencia externa (sin tocar ese repo aquí):** subir `maxSlots` a 40 en weekly-prompts (p.ej. `MAX_SLOT=39`), redeploy API Cleexs y, si aplica, migración de esquema/producción.

## Aislamiento

- Servidor: brand fijo `CLEEXS_BRAND_ID` + portal auth; el body no elige marca.
- Cliente: proyectos locales no leen/escriben Cleexs del brand env; CSV durable solo en proyecto Cleexs vinculado.
