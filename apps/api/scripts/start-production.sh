#!/bin/sh
set -e

SCHEMA="../../prisma/schema.prisma"

echo "→ Aplicando migraciones Prisma..."
npx prisma migrate deploy --schema="$SCHEMA"

if [ "$RUN_DB_SEED" = "true" ]; then
  echo "→ Ejecutando seed inicial..."
  npx tsx ../../prisma/seed.ts
fi

echo "→ Iniciando API..."
exec node dist/index.js
