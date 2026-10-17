#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
siblings="$(dirname "$root")"
cli="$siblings/deepseek-codex-grok-cli-integration"
voice="$siblings/deepseek-microphone-cleanup-integration"
plugin="$root/plugins/dsh-agents-pro"

for candidate in "$cli" "$voice"; do
  if [[ ! -f "$candidate/package.json" ]]; then
    printf 'Missing integration checkout: %s\n' "$candidate" >&2
    exit 1
  fi
done

npm install --prefix "$voice" --ignore-scripts --no-audit --no-fund
npm install --prefix "$plugin" --ignore-scripts --no-audit --no-fund
printf 'Agents Pro integrations installed from sibling checkouts.\n'
