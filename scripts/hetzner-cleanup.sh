#!/bin/bash
# Emergency: Delete all getopscore-managed Hetzner VMs
# Usage: HETZNER_API_TOKEN=xxx ./scripts/hetzner-cleanup.sh [--dry-run]
set -e

if [ -z "$HETZNER_API_TOKEN" ]; then
  echo "ERROR: HETZNER_API_TOKEN not set"
  exit 1
fi

DRY_RUN=false
[ "$1" = "--dry-run" ] && DRY_RUN=true

echo "Fetching getopscore-managed servers..."
RESPONSE=$(curl -s -H "Authorization: Bearer $HETZNER_API_TOKEN" \
  "https://api.hetzner.cloud/v1/servers?label_selector=getopscore%2Fmanaged%3Dtrue")

SERVER_IDS=$(echo "$RESPONSE" | python3 -c "import json,sys; data=json.load(sys.stdin); [print(s['id']) for s in data.get('servers',[])]" 2>/dev/null || echo "")

if [ -z "$SERVER_IDS" ]; then
  echo "No managed servers found."
  exit 0
fi

COUNT=$(echo "$SERVER_IDS" | wc -l)
echo "Found $COUNT server(s) to delete"

for ID in $SERVER_IDS; do
  if [ "$DRY_RUN" = "true" ]; then
    echo "[DRY RUN] Would delete server $ID"
  else
    echo "Deleting server $ID..."
    curl -s -X DELETE -H "Authorization: Bearer $HETZNER_API_TOKEN" \
      "https://api.hetzner.cloud/v1/servers/$ID"
    echo "Deleted server $ID"
  fi
done

echo "Done."
