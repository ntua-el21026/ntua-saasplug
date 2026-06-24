#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/postman/lib/env.sh"
init_postman_runner "$@"

SMOKE_COLLECTION="docs/postman/saasPlug.local.smoke.postman_collection.json"

TOKEN_ENV="$REPORT_DIR/security.preflight.environment.json"
SECURITY_COLLECTION="docs/postman/saasPlug.local.security.postman_collection.json"

echo "Suite: saasPlug.local.security"
echo "Estimated target call count: 1088 = 34 requests * 32 iterations"
echo "Selected app env file: $SAASPLUG_SELECTED_ENV_FILE"
echo "Postman environment file: $POSTMAN_ENV_FILE"
echo "Running smoke preflight to hydrate role tokens..."
run_newman run "$SMOKE_COLLECTION"   -e "$POSTMAN_ENV_FILE"   "${DEMO_ENV_ARGS[@]}"   --reporters cli,json   --reporter-json-export "$REPORT_DIR/security-preflight-smoke.json"   --export-environment "$TOKEN_ENV"

run_newman run "$SECURITY_COLLECTION"   -e "$TOKEN_ENV"   "${DEMO_ENV_ARGS[@]}"   -d "docs/postman/data/security.negative-cases.json"   --reporters cli,json   --reporter-json-export "$REPORT_DIR/security.json"   --export-environment "$TOKEN_ENV"
