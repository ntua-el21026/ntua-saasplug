#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

scripts/lint/run-python.sh
scripts/lint/run-markdown.sh
npm --prefix apps/frontend run lint
