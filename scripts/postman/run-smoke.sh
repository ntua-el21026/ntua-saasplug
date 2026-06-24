#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

REPORT_DIR="reports/postman"
mkdir -p "$REPORT_DIR"

ENV_FILE="docs/postman/saasPlug.local.postman_environment.json"
SMOKE_COLLECTION="docs/postman/saasPlug.local.smoke.postman_collection.json"

run_newman() {
  npx --yes newman "$@"
}

echo "Suite: saasPlug.local.smoke"
echo "Estimated call count: 14"
run_newman run "$SMOKE_COLLECTION"   -e "$ENV_FILE"   --reporters cli,json   --reporter-json-export "$REPORT_DIR/smoke.json"   --export-environment "$REPORT_DIR/smoke.environment.json"
