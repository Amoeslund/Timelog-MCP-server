#!/usr/bin/env bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/.."

if [ -s "$NVM_DIR/nvm.sh" ]; then
  source "$NVM_DIR/nvm.sh" --no-use
  NODE_VERSION=$(cat "$REPO_ROOT/.nvmrc" 2>/dev/null || echo "22")
  nvm exec --silent "$NODE_VERSION" node "$REPO_ROOT/dist/index.js" "$@"
else
  exec node "$REPO_ROOT/dist/index.js" "$@"
fi
