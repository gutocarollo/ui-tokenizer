#!/usr/bin/env bash
#
# Capture immutable, matrix-bound rendered evidence.
#
# Usage:
#   scripts/ui-evidence.sh <label>
#     --run-config <config.json> [--root <app>] [--run-root <run>]
#     [--batch-id B0001]
#     [--phase global-before|before|after|final]
#     [--routes /a,/b]
#     [--scenario-ids route/default,...]
#     [--themes light,dark]
#     [--projects mobile-sm,mobile-md,tablet,desktop]
#     [--project desktop]                # legacy single-project alias
#     [--locales en-US]
#     [--writing-modes ltr]
#
# A successful run stages the complete Playwright matrix, creates a fail-closed
# evidence-manifest v2, and atomically promotes the directory. Existing labels
# are immutable and are never overwritten. Failed staging directories are
# retained under `.claude/evidence/FAILED-*` for diagnosis but contain no valid
# promoted manifest.
set -uo pipefail

TOOL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$TOOL_ROOT"
RUN_CONFIG=""
RUN_ROOT=""

WEB_URL="${PLAYWRIGHT_WEB_URL:-http://localhost:3006}"
LABEL=""
RUN_ID=""
BATCH_ID=""
PHASE=""
ROUTES=""
SCENARIO_IDS=""
THEMES=""
PROJECTS=""
LOCALES=""
WRITING_MODES=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --run-id) RUN_ID="${2:-}"; shift 2 ;;
    --run-config) RUN_CONFIG="${2:-}"; shift 2 ;;
    --run-root) RUN_ROOT="${2:-}"; shift 2 ;;
    --root) WEB_DIR="${2:-}"; shift 2 ;;
    --batch-id) BATCH_ID="${2:-}"; shift 2 ;;
    --phase) PHASE="${2:-}"; shift 2 ;;
    --routes) ROUTES="${2:-}"; shift 2 ;;
    --scenario-ids) SCENARIO_IDS="${2:-}"; shift 2 ;;
    --themes) THEMES="${2:-}"; shift 2 ;;
    --projects) PROJECTS="${2:-}"; shift 2 ;;
    --project) PROJECTS="${2:-}"; shift 2 ;;
    --locales) LOCALES="${2:-}"; shift 2 ;;
    --writing-modes) WRITING_MODES="${2:-}"; shift 2 ;;
    --*) echo "ui-evidence: unknown option $1" >&2; exit 2 ;;
    *)
      if [ -n "$LABEL" ]; then
        echo "ui-evidence: only one label is allowed." >&2
        exit 2
      fi
      LABEL="$1"
      shift
      ;;
  esac
done

WEB_DIR="$(cd "$WEB_DIR" && pwd)"
REPO_ROOT="$(git -C "$WEB_DIR" rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
  echo "ui-evidence: cannot resolve the Git repository root from $WEB_DIR." >&2
  exit 1
fi
if [ -n "$RUN_CONFIG" ]; then
  RUN_CONFIG="$(cd "$(dirname "$RUN_CONFIG")" && pwd)/$(basename "$RUN_CONFIG")"
  RUN_ID="$(node -e 'const fs=require("fs"); const c=JSON.parse(fs.readFileSync(process.argv[1])); process.stdout.write(c.runId||"")' "$RUN_CONFIG")"
fi

LABEL="${LABEL:-after}"
if [[ ! "$LABEL" =~ ^[a-zA-Z0-9._-]+$ ]]; then
  echo "ui-evidence: label must match [a-zA-Z0-9._-]+." >&2
  exit 2
fi
RUN_ID="${RUN_ID:-tokenize-ui-${LABEL}}"
if [[ ! "$RUN_ID" =~ ^tokenize-[a-zA-Z0-9._-]+$ ]]; then
  echo "ui-evidence: run ID must match tokenize-[a-zA-Z0-9._-]+." >&2
  exit 2
fi
if [ -z "$PHASE" ]; then
  case "$LABEL" in
    global-before*) PHASE="global-before" ;;
    before*) PHASE="before" ;;
    final*) PHASE="final" ;;
    *) PHASE="after" ;;
  esac
fi
case "$PHASE" in
  global-before|final) ;;
  before|after) BATCH_ID="${BATCH_ID:-B0000}" ;;
  *) echo "ui-evidence: invalid phase $PHASE." >&2; exit 2 ;;
esac
if [ -n "$BATCH_ID" ] && [[ ! "$BATCH_ID" =~ ^B[0-9]{4,}$ ]]; then
  echo "ui-evidence: batch ID must match B[0-9]{4,}." >&2
  exit 2
fi

code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$WEB_URL" 2>/dev/null || true)"
if [ -z "$code" ] || [[ "$code" =~ ^0+$ ]] || [ "${#code}" -lt 3 ]; then
  echo "ui-evidence: preflight failed; $WEB_URL is not responding (HTTP '$code')." >&2
  echo "Start the development stack or set PLAYWRIGHT_WEB_URL explicitly." >&2
  exit 1
fi
if ! compgen -G "${HOME}/.cache/ms-playwright/chromium-*" >/dev/null; then
  echo "ui-evidence: Playwright Chromium is absent." >&2
  echo "Run: cd $WEB_DIR && npx playwright install chromium" >&2
  exit 1
fi

if [ -n "$RUN_ROOT" ]; then
  RUN_ROOT="$(cd "$RUN_ROOT" && pwd)"
  EVIDENCE_ROOT="$RUN_ROOT/artifacts/$BATCH_ID"
else
  EVIDENCE_ROOT="$REPO_ROOT/.claude/evidence"
fi
if [ -n "$RUN_ROOT" ]; then
  OUT_DIR="$EVIDENCE_ROOT/$PHASE"
else
  OUT_DIR="$EVIDENCE_ROOT/$LABEL"
fi
mkdir -p "$EVIDENCE_ROOT"
if [ -e "$OUT_DIR" ]; then
  echo "ui-evidence: immutable label already exists: $OUT_DIR" >&2
  echo "Choose a new label; evidence is never overwritten." >&2
  exit 1
fi
STAGING_DIR="$(mktemp -d "$EVIDENCE_ROOT/.staging-${LABEL}.XXXXXX")"
SELECTION_FILE="$STAGING_DIR/selection.json"
MANIFEST_CONFIG="$STAGING_DIR/manifest-config.json"

failed_stage() {
  local reason="$1"
  local failed="$EVIDENCE_ROOT/FAILED-${LABEL}-$(date -u +%Y%m%dT%H%M%SZ)-$$"
  if [ -d "$STAGING_DIR" ]; then
    mv -- "$STAGING_DIR" "$failed"
    echo "ui-evidence: $reason; failed staging retained at $failed" >&2
  else
    echo "ui-evidence: $reason" >&2
  fi
}

cd "$TOOL_ROOT"

config_value() {
  python3 - "$1" <<'PYCONF' 2>/dev/null || true
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(".harness/lib").resolve()))
try:
    from _tooling_conf import get_config
    print(get_config(sys.argv[1], "") or "")
except Exception:
    print("")
PYCONF
}

previous_directory="$PWD"
cd "$REPO_ROOT" || exit 1
ERROR_SELECTOR_VALUE="$(config_value HARNESS_UI_EVIDENCE_ERROR_SELECTOR)"
MASK_SELECTORS_VALUE="$(config_value HARNESS_UI_EVIDENCE_MASK_SELECTORS)"
cd "$previous_directory" || exit 1

PREPARE_ARGS=(
  --run-config "$RUN_CONFIG"
  --root "$WEB_DIR"
  --phase "$PHASE"
  --selection-out "$SELECTION_FILE"
  --manifest-config-out "$MANIFEST_CONFIG"
)
[ -n "$BATCH_ID" ] && PREPARE_ARGS+=(--batch-id "$BATCH_ID")
[ -n "$ROUTES" ] && PREPARE_ARGS+=(--routes "$ROUTES")
[ -n "$SCENARIO_IDS" ] && PREPARE_ARGS+=(--scenario-ids "$SCENARIO_IDS")
[ -n "$THEMES" ] && PREPARE_ARGS+=(--themes "$THEMES")
[ -n "$PROJECTS" ] && PREPARE_ARGS+=(--projects "$PROJECTS")
[ -n "$LOCALES" ] && PREPARE_ARGS+=(--locales "$LOCALES")
[ -n "$WRITING_MODES" ] && PREPARE_ARGS+=(--writing-modes "$WRITING_MODES")

if [ -z "$RUN_CONFIG" ]; then
  failed_stage "--run-config is required; a typed run id is not evidence identity"
  exit 2
fi
if ! node "$TOOL_ROOT/scripts/prepare-evidence-run.mjs" "${PREPARE_ARGS[@]}"; then
  failed_stage "matrix preparation failed"
  exit 1
fi

PROJECT_ARGS=()
if [ -n "$PROJECTS" ]; then
  IFS=',' read -r -a requested_projects <<< "$PROJECTS"
  for project in "${requested_projects[@]}"; do
    project="${project//[[:space:]]/}"
    [ -n "$project" ] && PROJECT_ARGS+=(--project="$project")
  done
fi

echo "ui-evidence: label=$LABEL run=$RUN_ID phase=$PHASE url=$WEB_URL"
echo "ui-evidence: staging=$STAGING_DIR projects=${PROJECTS:-all}"

PLAYWRIGHT_WEB_URL="$WEB_URL" \
UI_EVIDENCE_LABEL="$LABEL" \
UI_EVIDENCE_SELECTION_FILE="$SELECTION_FILE" \
UI_EVIDENCE_OUTPUT_DIR="$STAGING_DIR" \
HARNESS_UI_EVIDENCE_ERROR_SELECTOR="${HARNESS_UI_EVIDENCE_ERROR_SELECTOR:-$ERROR_SELECTOR_VALUE}" \
HARNESS_UI_EVIDENCE_MASK_SELECTORS="${HARNESS_UI_EVIDENCE_MASK_SELECTORS:-$MASK_SELECTORS_VALUE}" \
  npx playwright test -c "$TOOL_ROOT/playwright.visual.config.ts" "$TOOL_ROOT/tests/visual/evidence.spec.ts" \
  "${PROJECT_ARGS[@]}" 2>&1 | tail -40
PLAYWRIGHT_EXIT=${PIPESTATUS[0]}
if [ "$PLAYWRIGHT_EXIT" -ne 0 ]; then
  failed_stage "Playwright exited with code $PLAYWRIGHT_EXIT"
  exit "$PLAYWRIGHT_EXIT"
fi

if ! node "$TOOL_ROOT/scripts/evidence-manifest.mjs" --root "$WEB_DIR" \
  --config "$MANIFEST_CONFIG" \
  --capture-dir "$STAGING_DIR" \
  --out "$STAGING_DIR/manifest.json"; then
  failed_stage "manifest v2 validation failed"
  exit 1
fi

mv -- "$STAGING_DIR" "$OUT_DIR"
echo "ui-evidence: PASS; immutable evidence promoted to $OUT_DIR"
