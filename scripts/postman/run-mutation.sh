#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/postman/lib/env.sh"
init_postman_runner "$@"

SMOKE_COLLECTION="docs/postman/saasPlug.local.smoke.postman_collection.json"

TOKEN_ENV="$REPORT_DIR/mutation.preflight.environment.json"
MUTATION_COLLECTION="docs/postman/saasPlug.local.mutation.postman_collection.json"
DATA_FILE="docs/postman/data/mutation.safe-local-cases.json"

echo "Suite: saasPlug.local.mutation"
echo "Estimated safe mutation call count: 17 = 7 + 4 + 2 + 4"
echo "Selected app env file: $SAASPLUG_SELECTED_ENV_FILE"
echo "Postman environment file: $POSTMAN_ENV_FILE"
echo "Running smoke preflight to hydrate operator/provider/EV tokens..."
run_newman run "$SMOKE_COLLECTION"   -e "$POSTMAN_ENV_FILE"   "${DEMO_ENV_ARGS[@]}"   --reporters cli,json   --reporter-json-export "$REPORT_DIR/mutation-preflight-smoke.json"   --export-environment "$TOKEN_ENV"

for folder in   "Local Auth Mutations"   "Reversible Provider Metadata"   "Pricing Local Mutations"   "Scheduler Reversible Mutations"
do
  safe_name="$(echo "$folder" | tr '[:upper:] ' '[:lower:]-')"
  run_newman run "$MUTATION_COLLECTION"     -e "$TOKEN_ENV"     "${DEMO_ENV_ARGS[@]}"     --folder "$folder"     -d "$DATA_FILE"     --reporters cli,json     --reporter-json-export "$REPORT_DIR/mutation-${safe_name}.json"     --export-environment "$TOKEN_ENV"
done
