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

TOKEN_ENV="$REPORT_DIR/security.preflight.environment.json"
SECURITY_COLLECTION="docs/postman/saasPlug.local.security.postman_collection.json"

echo "Suite: saasPlug.local.security"
echo "Estimated target call count: 1088 = 34 requests * 32 iterations"
echo "Running smoke preflight to hydrate role tokens..."
run_newman run "$SMOKE_COLLECTION"   -e "$ENV_FILE"   --reporters cli,json   --reporter-json-export "$REPORT_DIR/security-preflight-smoke.json"   --export-environment "$TOKEN_ENV"

run_newman run "$SECURITY_COLLECTION"   -e "$TOKEN_ENV"   -d "docs/postman/data/security.negative-cases.json"   --reporters cli,json   --reporter-json-export "$REPORT_DIR/security.json"   --export-environment "$TOKEN_ENV"
