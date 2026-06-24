#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/postman/lib/env.sh"
init_postman_runner "$@"

echo "Suite: all local Postman/Newman suites"
echo "Target call counts: smoke=14, regression=1235, security=1088, safe mutation=17"
echo "Selected app env file: $SAASPLUG_SELECTED_ENV_FILE"
echo "Postman environment file: $POSTMAN_ENV_FILE"
scripts/postman/run-smoke.sh --env-file "$SAASPLUG_SELECTED_ENV_FILE"
scripts/postman/run-regression.sh --env-file "$SAASPLUG_SELECTED_ENV_FILE"
scripts/postman/run-security.sh --env-file "$SAASPLUG_SELECTED_ENV_FILE"
scripts/postman/run-mutation.sh --env-file "$SAASPLUG_SELECTED_ENV_FILE"
