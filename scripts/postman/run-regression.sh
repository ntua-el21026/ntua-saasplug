#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/postman/lib/env.sh"
init_postman_runner "$@"

SMOKE_COLLECTION="docs/postman/saasPlug.local.smoke.postman_collection.json"

TOKEN_ENV="$REPORT_DIR/regression.preflight.environment.json"
REGRESSION_COLLECTION="docs/postman/saasPlug.local.regression.postman_collection.json"

echo "Suite: saasPlug.local.regression"
echo "Estimated target call count: 1235 = (11*30) + (8*30) + (13*25) + (17*20)"
echo "Selected app env file: $SAASPLUG_SELECTED_ENV_FILE"
echo "Postman environment file: $POSTMAN_ENV_FILE"
echo "Running smoke preflight to hydrate role tokens..."
run_newman run "$SMOKE_COLLECTION"   -e "$POSTMAN_ENV_FILE"   "${DEMO_ENV_ARGS[@]}"   --reporters cli,json   --reporter-json-export "$REPORT_DIR/regression-preflight-smoke.json"   --export-environment "$TOKEN_ENV"

run_newman run "$REGRESSION_COLLECTION"   -e "$TOKEN_ENV"   "${DEMO_ENV_ARGS[@]}"   --folder "EV Search Reads"   -d "docs/postman/data/regression.ev-search-cases.json"   --reporters cli,json   --reporter-json-export "$REPORT_DIR/regression-ev-search.json"   --export-environment "$TOKEN_ENV"

run_newman run "$REGRESSION_COLLECTION"   -e "$TOKEN_ENV"   "${DEMO_ENV_ARGS[@]}"   --folder "Catalog Status Reads"   -d "docs/postman/data/regression.catalog-status-cases.json"   --reporters cli,json   --reporter-json-export "$REPORT_DIR/regression-catalog-status.json"   --export-environment "$TOKEN_ENV"

run_newman run "$REGRESSION_COLLECTION"   -e "$TOKEN_ENV"   "${DEMO_ENV_ARGS[@]}"   --folder "Provider Read Cases"   -d "docs/postman/data/regression.provider-cases.json"   --reporters cli,json   --reporter-json-export "$REPORT_DIR/regression-provider.json"   --export-environment "$TOKEN_ENV"

run_newman run "$REGRESSION_COLLECTION"   -e "$TOKEN_ENV"   "${DEMO_ENV_ARGS[@]}"   --folder "Operator Read Cases"   -d "docs/postman/data/regression.operator-cases.json"   --reporters cli,json   --reporter-json-export "$REPORT_DIR/regression-operator.json"   --export-environment "$TOKEN_ENV"
