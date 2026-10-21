#!/usr/bin/env bash
# Builds the server, deploys infra/main.bicep (unless CODE_ONLY=true), zip-deploys the code and
# waits for /healthz. Needs an `az login` session with the subscription selected.
#
#   AZURE_RESOURCE_GROUP   required
#   TIMELOG_BASE_URL       required unless CODE_ONLY=true
#   TOKEN_ENCRYPTION_KEY   required unless CODE_ONLY=true (base64, 32 bytes; keep it stable)
#   SITE_NAME              default: impact-timelog-mcp-connector
#   CODE_ONLY              true to skip the Bicep pass
set -euo pipefail

cd "$(dirname "$0")/.."

: "${AZURE_RESOURCE_GROUP:?AZURE_RESOURCE_GROUP is required}"
SITE_NAME="${SITE_NAME:-impact-timelog-mcp-connector}"
CODE_ONLY="${CODE_ONLY:-false}"
PUBLIC_BASE_URL="https://${SITE_NAME}.azurewebsites.net"

if [ "$CODE_ONLY" != "true" ]; then
  : "${TIMELOG_BASE_URL:?TIMELOG_BASE_URL is required}"
  : "${TOKEN_ENCRYPTION_KEY:?TOKEN_ENCRYPTION_KEY is required}"
  # Fail here rather than as a crash-looping site.
  key_bytes=$(printf '%s' "$TOKEN_ENCRYPTION_KEY" | base64 -d 2>/dev/null | wc -c)
  if [ "$key_bytes" -ne 32 ]; then
    echo "TOKEN_ENCRYPTION_KEY must decode to 32 bytes (got $key_bytes). Generate with: openssl rand -base64 32" >&2
    exit 1
  fi
fi

echo "==> Building"
npm ci
npm run build

echo "==> Staging production package"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
cp -r dist package.json package-lock.json .npmrc "$stage/"
(cd "$stage" && npm ci --omit=dev --ignore-scripts && zip -qr ../app.zip . && mv ../app.zip ./app.zip)

if [ "$CODE_ONLY" != "true" ]; then
  echo "==> Deploying infrastructure to $AZURE_RESOURCE_GROUP"
  az deployment group create \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "timelog-mcp-$(date +%Y%m%d%H%M%S)" \
    --template-file infra/main.bicep \
    --parameters infra/main.parameters.json \
    --parameters siteName="$SITE_NAME" timelogBaseUrl="$TIMELOG_BASE_URL" tokenEncryptionKey="$TOKEN_ENCRYPTION_KEY" \
    --only-show-errors --output none
fi

echo "==> Deploying code to $SITE_NAME"
az webapp deploy \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$SITE_NAME" \
  --src-path "$stage/app.zip" \
  --type zip \
  --only-show-errors --output none

echo "==> Waiting for $PUBLIC_BASE_URL/healthz"
for _ in $(seq 1 30); do
  if curl -fsS "$PUBLIC_BASE_URL/healthz" >/dev/null 2>&1; then
    echo "Healthy. MCP endpoint: $PUBLIC_BASE_URL/mcp"
    exit 0
  fi
  sleep 10
done
echo "Site did not report healthy within 5 minutes. Check App Service -> Log stream." >&2
exit 1
