#!/usr/bin/env sh
# Local stack: production compose + local overlay (ports + Vite HMR)
set -eu
cd "$(dirname "$0")/.."

echo "Starting local stack (compose + local overlay)…"
docker compose \
  -f docker-compose.yaml \
  -f docker-compose.local.yaml \
  up -d --build "$@"

echo ""
echo "  Frontend:  http://localhost:${FRONTEND_PORT:-8080}"
echo "  Backend:   http://localhost:${BACKEND_PORT:-4000}/api/health"
echo "  Postgres:  localhost:${POSTGRES_PUBLISH_PORT:-5436}"
echo ""
echo "  Stop with: docker compose -f docker-compose.yaml -f docker-compose.local.yaml down"
