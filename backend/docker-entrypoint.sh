#!/bin/sh
set -e

node /app/scripts/validate-deploy-env.cjs

/app/docker-migrate.sh

echo "Seeding default client and superadmin (idempotent)..."
if ! node /app/prisma/seed.js; then
  echo "WARN: Superadmin seed failed; API will still start (check DATABASE_URL and SUPERADMIN_* env vars)."
fi

echo "Starting API server..."
exec node server.js
