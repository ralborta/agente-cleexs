#!/usr/bin/env bash
# Flujo end-to-end local: misión → aprobación → WordPress
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a && source .env && set +a

API="${API_URL:-http://localhost:4000}"
WS="cleexs"

echo "1/5 Crear misión..."
MISSION=$(curl -sf -X POST "$API/api/missions" \
  -H 'Content-Type: application/json' \
  -d "{\"workspaceSlug\":\"$WS\",\"autoExecute\":true}")
echo "$MISSION" | head -c 200
echo ""

echo "2/5 Esperando executor (5s)..."
sleep 5

echo "3/5 Listar aprobaciones..."
APPROVALS=$(curl -sf "$API/api/approvals?workspace=$WS&status=pending")
ID=$(echo "$APPROVALS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['approvals'][0]['id'] if d['approvals'] else '')" 2>/dev/null || true)

if [ -z "$ID" ]; then
  echo "No hay aprobaciones pendientes. Revisá logs de la API."
  exit 1
fi

echo "4/5 Aprobar $ID → WordPress..."
RESULT=$(curl -sf -X POST "$API/api/approvals/$ID/approve" \
  -H 'Content-Type: application/json' \
  -d '{"wpStatus":"draft"}')
echo "$RESULT"

echo "5/5 OK — flujo completo"
