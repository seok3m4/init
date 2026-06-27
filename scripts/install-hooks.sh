#!/usr/bin/env bash
set -euo pipefail

ROLE="A"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -Role|--role)
      ROLE="${2:-}"
      shift 2
      ;;
    *)
      echo "[fail] unknown argument: $1"
      exit 1
      ;;
  esac
done

case "$ROLE" in
  A|B|C|D|E|PM) ;;
  *)
    echo "[fail] invalid role: $ROLE"
    exit 1
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$ROOT/.git/hooks"

if [[ ! -d "$HOOKS_DIR" ]]; then
  echo "[fail] .git/hooks not found"
  exit 1
fi

HOOK_PATH="$HOOKS_DIR/pre-commit"
cat > "$HOOK_PATH" <<EOF
#!/usr/bin/env sh
set -eu

exec ./scripts/check-local.sh -Role $ROLE
EOF

chmod +x "$HOOK_PATH"
echo "[ok] installed pre-commit hook for role $ROLE"
