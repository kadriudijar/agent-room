#!/usr/bin/env bash
# Installs Agent Room: the agent-room mod into ~/.claude/skills (Claude Code loads it in every session)
# and claude-room into ~/.local/bin. `--uninstall` removes only links that point into this repo.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
MOD_LINK="$CONFIG_DIR/skills/agent-room"
BIN_LINK="$HOME/.local/bin/claude-room"

link() {
  local target="$1" path="$2"
  if [[ -L "$path" && "$(readlink "$path")" == "$target" ]]; then
    echo "  unchanged  $path"
    return
  fi
  if [[ -e "$path" && ! -L "$path" ]]; then
    echo "  refusing   $path exists and is not a symlink; move it away first" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$path")"
  ln -sfn "$target" "$path"
  echo "  linked     $path -> $target"
}

unlink_ours() {
  local path="$1"
  if [[ -L "$path" && "$(readlink "$path")" == "$REPO"/* ]]; then
    rm "$path"
    echo "  removed    $path"
  else
    echo "  skipped    $path (not a link into $REPO)"
  fi
}

if [[ "${1:-}" == "--uninstall" ]]; then
  unlink_ours "$MOD_LINK"
  unlink_ours "$BIN_LINK"
  exit 0
fi

# claude-room needs import.meta.main, which arrived in Node 24.2.
node_version="$(node -p 'process.versions.node' 2>/dev/null || echo 0.0)"
IFS=. read -r node_major node_minor _ <<< "$node_version"
if (( node_major < 24 || (node_major == 24 && node_minor < 2) )); then
  echo "claude-room needs Node 24.2 or newer (found ${node_version})." >&2
  exit 1
fi

chmod +x "$REPO/viewer/claude-room.ts"
link "$REPO/mod" "$MOD_LINK"
link "$REPO/viewer/claude-room.ts" "$BIN_LINK"

case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) echo "  note       ~/.local/bin is not on PATH; add it to run claude-room by name" ;;
esac
echo "Done. New Claude sessions write their room; run claude-room in a Ghostty tab."
