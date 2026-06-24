#!/usr/bin/env bash

usage_postman_runner() {
  local script_name
  script_name="$(basename "$0")"
  cat <<USAGE
Usage: scripts/postman/${script_name} [--env-file <path>]

Options:
  --env-file <path>  Read the seeded demo password from this local env file.
  -h, --help         Show this help text.

Env-file precedence:
  1. CLI --env-file <path>
  2. SAASPLUG_ENV_FILE
  3. .env

POSTMAN_ENV_FILE may override the Postman environment JSON path.
USAGE
}

resolve_saasplug_env_file() {
  local selected_env_file="${SAASPLUG_ENV_FILE:-.env}"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --env-file)
        if [[ $# -lt 2 ]]; then
          echo "Missing value for --env-file." >&2
          usage_postman_runner >&2
          exit 2
        fi
        selected_env_file="$2"
        shift 2
        ;;
      --env-file=*)
        selected_env_file="${1#--env-file=}"
        shift
        ;;
      -h|--help)
        usage_postman_runner
        exit 0
        ;;
      *)
        echo "Unknown argument: $1" >&2
        usage_postman_runner >&2
        exit 2
        ;;
    esac
  done

  SAASPLUG_SELECTED_ENV_FILE="$selected_env_file"
}

read_env_value() {
  local env_file="$1"
  local key="$2"
  local line raw value

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    raw="${line#"${line%%[![:space:]]*}"}"

    [[ -z "$raw" ]] && continue
    [[ "$raw" == \#* ]] && continue

    if [[ "$raw" == export[[:space:]]* ]]; then
      raw="${raw#export}"
      raw="${raw#"${raw%%[![:space:]]*}"}"
    fi

    [[ "$raw" == "$key="* ]] || continue

    value="${raw#*=}"
    if [[ ${#value} -ge 2 ]]; then
      if [[ "$value" == \"*\" && "$value" == *\" ]]; then
        value="${value:1:${#value}-2}"
      elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
        value="${value:1:${#value}-2}"
      fi
    fi

    printf '%s' "$value"
    return 0
  done < "$env_file"

  return 1
}

load_demo_password() {
  local env_file="$1"
  local key value
  local candidates=(
    DEMO_USER_PASSWORD
    DEMO_PASSWORD
    SEED_DEMO_PASSWORD
    AUTH_DEMO_PASSWORD
    AUTH_SEED_PASSWORD
    SAASPLUG_DEMO_PASSWORD
  )

  if [[ ! -f "$env_file" ]]; then
    echo "Selected env file does not exist: $env_file" >&2
    exit 1
  fi

  for key in "${candidates[@]}"; do
    if value="$(read_env_value "$env_file" "$key")"; then
      if [[ -n "$value" ]]; then
        DEMO_PASSWORD_VALUE="$value"
        DEMO_PASSWORD_KEY="$key"
        return 0
      fi
    fi
  done

  echo "No supported seeded demo password variable was found in: $env_file" >&2
  echo "Supported names: ${candidates[*]}" >&2
  exit 1
}

init_postman_runner() {
  if [[ -z "${ROOT_DIR:-}" ]]; then
    echo "ROOT_DIR must be set before sourcing scripts/postman/lib/env.sh." >&2
    exit 2
  fi

  cd "$ROOT_DIR"

  REPORT_DIR="${REPORT_DIR:-reports/postman}"
  POSTMAN_ENV_FILE="${POSTMAN_ENV_FILE:-docs/postman/saasPlug.local.postman_environment.json}"

  resolve_saasplug_env_file "$@"
  load_demo_password "$SAASPLUG_SELECTED_ENV_FILE"

  mkdir -p "$REPORT_DIR"
  DEMO_ENV_ARGS=(--env-var "demoPassword=${DEMO_PASSWORD_VALUE}")

  export REPORT_DIR
  export POSTMAN_ENV_FILE
  export SAASPLUG_SELECTED_ENV_FILE
}

run_newman() {
  npx --yes newman "$@"
}
