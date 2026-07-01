#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

show_help() {
  cat <<'EOF'
Import missing memory images into wordbase for specific terms.

Usage:
  ./scripts/wordbase_import/import-missing-images-by-term.sh "subduction zone" "sustainability indicator"
  npm run wordbase:import-missing-images -- "subduction zone"

Examples:
  npm run wordbase:import-missing-images:dry-run -- "subduction zone"
  npm run wordbase:import-missing-images -- --terms "subduction zone,sustainability indicator"
  npm run wordbase:import-missing-images -- --term "subduction zone" --term "sustainability indicator"
EOF
}

if [[ $# -eq 0 ]]; then
  show_help
  exit 1
fi

args=(--images-only --no-resume)
term_args=()
forward_args=()

for arg in "$@"; do
  if [[ "$arg" == --* ]]; then
    forward_args+=("$arg")
  else
    term_args+=(--term "$arg")
  fi
done

if [[ ${#term_args[@]} -eq 0 ]]; then
  has_terms_flag=false
  if ((${#forward_args[@]})); then
    for arg in "${forward_args[@]}"; do
      if [[ "$arg" == --terms || "$arg" == --terms=* ]]; then
        has_terms_flag=true
        break
      fi
      if [[ "$arg" == --term || "$arg" == --term=* ]]; then
        has_terms_flag=true
        break
      fi
    done
  fi

  if [[ "$has_terms_flag" == false ]]; then
    show_help
    exit 1
  fi
fi

cmd=(bash "$DIR/run-enrich-memory.sh" "${args[@]}")
if ((${#forward_args[@]})); then
  cmd+=("${forward_args[@]}")
fi
if ((${#term_args[@]})); then
  cmd+=("${term_args[@]}")
fi
exec "${cmd[@]}"
