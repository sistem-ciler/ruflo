#!/usr/bin/env bash
# deploy.sh — Pull latest code and redeploy RuFlo services
# Run as the app user (ops) or via GitHub Actions.
# Usage: bash deploy.sh [branch]
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ruflo}"
BRANCH="${1:-main}"
COMPOSE_FILE="$APP_DIR/ruflo/docker-compose.yml"

echo "==> RuFlo deploy (branch: $BRANCH)"
cd "$APP_DIR"

# ---- 1. Pull latest code ----
echo "==> Pulling latest changes..."
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# ---- 2. Build and restart services ----
echo "==> Building and restarting containers..."
docker compose -f "$COMPOSE_FILE" build --parallel
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# ---- 3. Clean up old images ----
echo "==> Pruning unused Docker images..."
docker image prune -f --filter "until=24h"

# ---- 4. Health checks ----
echo "==> Waiting for services to start..."
sleep 10

SERVICES=("mongodb" "mcp-bridge" "chat-ui" "nginx")
ALL_OK=true
for svc in "${SERVICES[@]}"; do
  STATUS=$(docker compose -f "$COMPOSE_FILE" ps --format '{{.Status}}' "$svc" 2>/dev/null || echo "not found")
  if echo "$STATUS" | grep -qi "up"; then
    echo "  ✓ $svc: $STATUS"
  else
    echo "  ✗ $svc: $STATUS"
    ALL_OK=false
  fi
done

if $ALL_OK; then
  echo ""
  echo "==> Deploy successful! All services running."
  echo "    Access: http://$(hostname -I | awk '{print $1}'):3000"
else
  echo ""
  echo "==> WARNING: Some services may not be healthy. Check logs:"
  echo "    docker compose -f $COMPOSE_FILE logs --tail 50"
  exit 1
fi
