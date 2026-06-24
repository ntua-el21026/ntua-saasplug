#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/postman/lib/env.sh"
init_postman_runner "$@"

SMOKE_COLLECTION="docs/postman/saasPlug.local.smoke.postman_collection.json"

echo "Suite: saasPlug.local.smoke"
echo "Estimated call count: 14"
echo "Selected app env file: $SAASPLUG_SELECTED_ENV_FILE"
echo "Postman environment file: $POSTMAN_ENV_FILE"
run_newman run "$SMOKE_COLLECTION"   -e "$POSTMAN_ENV_FILE"   "${DEMO_ENV_ARGS[@]}"   --reporters cli,json   --reporter-json-export "$REPORT_DIR/smoke.json"   --export-environment "$REPORT_DIR/smoke.environment.json"
