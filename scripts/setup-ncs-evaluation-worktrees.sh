#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_REF="HEAD"
WORKTREE_ROOT="$(dirname "$ROOT")/ncs-evaluation-worktrees"
APPLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-ref)
      BASE_REF="$2"
      shift 2
      ;;
    --worktree-root)
      WORKTREE_ROOT="$2"
      shift 2
      ;;
    --apply)
      APPLY=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

BASE_COMMIT="$(git -C "$ROOT" rev-parse --verify "${BASE_REF}^{commit}")"
git -C "$ROOT" cat-file -e "${BASE_COMMIT}:docs/04_implementation/ncs-evaluation-m0/README.md"

BRANCHES=(
  "experiment/ncs-eval-common-rubric"
  "experiment/ncs-eval-evidence-state"
  "experiment/ncs-eval-pairwise"
  "experiment/ncs-eval-hybrid"
)
DIRECTORIES=("common-rubric" "evidence-state" "pairwise" "hybrid")

echo "Base commit: $BASE_COMMIT"
echo "Worktree root: $WORKTREE_ROOT"
if [[ "$APPLY" -eq 1 ]]; then echo "Mode: APPLY"; else echo "Mode: DRY-RUN"; fi

for index in "${!BRANCHES[@]}"; do
  branch="${BRANCHES[$index]}"
  target="$WORKTREE_ROOT/${DIRECTORIES[$index]}"
  git -C "$ROOT" check-ref-format --branch "$branch" >/dev/null
  if [[ -e "$target" ]]; then
    echo "Target path already exists: $target" >&2
    exit 1
  fi
  if git -C "$ROOT" show-ref --verify --quiet "refs/heads/$branch"; then
    echo "git worktree add \"$target\" $branch"
    if [[ "$APPLY" -eq 1 ]]; then git -C "$ROOT" worktree add "$target" "$branch"; fi
  else
    echo "git worktree add -b $branch \"$target\" $BASE_COMMIT"
    if [[ "$APPLY" -eq 1 ]]; then git -C "$ROOT" worktree add -b "$branch" "$target" "$BASE_COMMIT"; fi
  fi
done

if [[ "$APPLY" -eq 1 ]]; then
  echo "[ok] NCS evaluation worktrees created"
else
  echo "[ok] dry-run complete; rerun with --apply to create worktrees"
fi
