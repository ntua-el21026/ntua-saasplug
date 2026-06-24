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

echo "Suite: all local Postman/Newman suites"
echo "Target call counts: smoke=14, regression=1235, security=1088, safe mutation=17"
scripts/postman/run-smoke.sh
scripts/postman/run-regression.sh
scripts/postman/run-security.sh
scripts/postman/run-mutation.sh
