#!/bin/sh
set -eu

# Prefer Nitro/TanStack Start server entry if present
SSR_ENTRY=""
for candidate in \
  .output/server/index.mjs \
  .output/server/index.js \
  dist/server/index.mjs \
  dist/server/index.js
do
  if [ -f "$candidate" ]; then
    SSR_ENTRY="$candidate"
    break
  fi
done

if [ -z "$SSR_ENTRY" ]; then
  echo "ERROR: No SSR server entry found under .output/ or dist/"
  ls -la .output 2>/dev/null || true
  ls -la dist 2>/dev/null || true
  exit 1
fi

echo "Starting SSR: node $SSR_ENTRY (PORT=${PORT:-3000})"
node "$SSR_ENTRY" &
SSR_PID=$!

# Give SSR a moment to bind; fail fast if it dies
sleep 1
if ! kill -0 "$SSR_PID" 2>/dev/null; then
  echo "ERROR: SSR process exited early"
  exit 1
fi

echo "Starting nginx on :80"
exec nginx -g "daemon off;"
