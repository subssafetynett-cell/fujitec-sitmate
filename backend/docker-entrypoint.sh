#!/bin/sh
set -e

export DOTENV_CONFIG_QUIET=true

node /app/scripts/validate-deploy-env.cjs

/app/docker-migrate.sh

echo "Seeding superadmin (if missing)..."
node /app/prisma/seed.js || echo "WARN: Superadmin seed skipped."

echo "Starting API server..."
exec node server.js
