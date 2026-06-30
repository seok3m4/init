#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${1:-${GITHUB_BASE_REF:-}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

changed_files() {
  cd "$ROOT"
  if [[ -n "$BASE_REF" ]]; then
    local remote_base="origin/$BASE_REF"
    if ! git rev-parse --verify "$remote_base" >/dev/null 2>&1; then
      git fetch origin "$BASE_REF" --depth=1 >/dev/null
    fi
    git diff --name-only "$remote_base...HEAD"
    return
  fi

  {
    git diff --name-only
    git diff --cached --name-only
    git ls-files --others --exclude-standard
  }
}

changed=()
while IFS= read -r file; do
  changed+=("$file")
done < <(
  changed_files \
    | sed 's#\\#/#g' \
    | awk 'NF' \
    | awk '$0 !~ /(^|\/)node_modules\// && $0 !~ /(^|\/)(\.next|dist|build|coverage)\//' \
    | sort -u
)

if [[ "${#changed[@]}" -eq 0 ]]; then
  echo "[ok] no changed files for auto ownership check"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    {
      echo "roles_csv="
      echo "roles_json=[]"
    } >> "$GITHUB_OUTPUT"
  fi
  exit 0
fi

common='^(AGENTS\.md|docs/05_agents/|docs/04_implementation/(team-split-5dev-1pm|test-strategy|module-boundaries|task-split|milestones)\.md|docs/04_implementation/one-time-alignment/agent-[a-e]\.md|docs/04_implementation/one-time-alignment/agent-pm\.md|scripts/|\.github/|\.gitignore$)'
baseline='^(backend/api/src/modules/(auth|company-recruiting|company-interview|company-profile|candidate|interview|report|ai)/\.gitkeep|backend/common/src/(enums|dto|errors)/\.gitkeep|frontend/src/features/company-profile/\.gitkeep|frontend/package(-lock)?\.json|frontend/(eslint\.config\.mjs|next-env\.d\.ts|next\.config\.(js|ts)|tsconfig\.json)|backend/(api|common|worker)/package(-lock)?\.json|backend/api/(jest\.config\.js|nest-cli\.json|tsconfig(\.build)?\.json)|backend/common/tsconfig\.json|backend/worker/tsconfig\.json)'
shared_backend='^(backend/api/src/modules/app\.module\.ts|backend/api/src/main\.ts)$'
shared_frontend_company='^frontend/src/app/company/layout\.tsx$'

role_pattern() {
  case "$1" in
    A) echo '(^backend/common/|^backend/api/prisma/|^backend/api/src/modules/auth/|^backend/api/src/shared/|^infra/|^docs/03_contracts/|^docs/02_architecture/)' ;;
    B) echo '(^frontend/src/features/company-recruiting/|^frontend/src/app/(layout\.tsx|page\.tsx|company/recruitments/|company/applicants/|company/applications/)|^frontend/src/styles/|^frontend/public/logo-init\.png$|^backend/api/src/modules/company-recruiting/)' ;;
    C) echo '(^frontend/src/features/company-interview-criteria/|^frontend/src/app/company/interviews/|^backend/api/src/modules/company-interview/)' ;;
    D) echo '(^frontend/src/features/candidate-application-interview/|^backend/api/src/modules/(candidate|interview)/)' ;;
    E) echo '(^frontend/src/features/ai-report/|^backend/worker/|^backend/api/src/modules/(report|ai)/|^docs/04_implementation/ai-golden/)' ;;
    PM) echo '(^docs/|^assets/)' ;;
  esac
}

impacted=()
blocked=()

add_impacted() {
  local role="$1"
  local existing
  if [[ "${#impacted[@]}" -gt 0 ]]; then
    for existing in "${impacted[@]}"; do
      if [[ "$existing" == "$role" ]]; then
        return
      fi
    done
  fi
  impacted+=("$role")
}

for file in "${changed[@]}"; do
  if [[ "$file" =~ $common || "$file" =~ $baseline ]]; then
    add_impacted COMMON
    continue
  fi

  if [[ "$file" =~ $shared_backend ]]; then
    add_impacted A
    add_impacted B
    add_impacted C
    add_impacted D
    add_impacted E
    continue
  fi

  if [[ "$file" =~ $shared_frontend_company ]]; then
    add_impacted A
    add_impacted B
    add_impacted C
    continue
  fi

  matched=0
  for role in A B C D E PM; do
    pattern="$(role_pattern "$role")"
    if [[ "$file" =~ $pattern ]]; then
      add_impacted "$role"
      matched=1
    fi
  done

  if [[ "$matched" -eq 0 ]]; then
    blocked+=("$file")
  fi
done

if [[ "${#blocked[@]}" -gt 0 ]]; then
  echo "[fail] files outside all known ownership:"
  printf '  %s\n' "${blocked[@]}"
  echo "[fail] verify-ownership-auto failed"
  exit 1
fi

roles="$(printf '%s\n' "${impacted[@]}" | sort -u | awk 'BEGIN { first = 1 } { if (!first) printf ", "; printf "%s", $0; first = 0 } END { print "" }')"
harness_roles="$(printf '%s\n' "${impacted[@]}" | sort -u | awk '$0 != "COMMON"')"
roles_csv="$(printf '%s\n' "$harness_roles" | awk 'NF' | awk 'BEGIN { first = 1 } { if (!first) printf ","; printf "%s", $0; first = 0 } END { print "" }')"
roles_json="$(printf '%s\n' "$harness_roles" | awk 'NF' | awk 'BEGIN { printf "["; first = 1 } { if (!first) printf ","; printf "\"%s\"", $0; first = 0 } END { print "]" }')"
if [[ -z "$roles_json" ]]; then
  roles_json="[]"
fi

echo "[ok] verify-ownership-auto passed"
echo "impacted roles: $roles"
echo "harness roles: $roles_csv"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "roles_csv=$roles_csv"
    echo "roles_json=$roles_json"
  } >> "$GITHUB_OUTPUT"
fi
