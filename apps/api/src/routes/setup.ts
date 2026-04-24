import type { Context } from "hono";

// Interactive shell setup script.
// Usage: curl r6.mosly.dev/setup | sh
//
// Reads platform + username from /dev/tty (works even when stdin is piped),
// saves to ~/.config/r6fetch/config, and adds an `r6` function to the user's shell rc.
const SETUP_SCRIPT = `#!/bin/sh
set -e

CONFIG_DIR="$HOME/.config/r6fetch"
CONFIG_FILE="$CONFIG_DIR/config"

printf "\\n  r6fetch setup\\n  ─────────────\\n\\n"

# Read from the terminal directly, even when stdin is a pipe
if [ -t 0 ]; then
  TTY=0
else
  TTY=/dev/tty
fi

printf "  Platform (pc / ps / xbox): "
read -r platform <"$TTY"

case "$platform" in
  pc|ps|xbox) ;;
  *) printf "\\n  Error: platform must be pc, ps, or xbox\\n\\n" && exit 1 ;;
esac

printf "  Username: "
read -r username <"$TTY"

if [ -z "$username" ]; then
  printf "\\n  Error: username cannot be empty\\n\\n" && exit 1
fi

# Save config
mkdir -p "$CONFIG_DIR"
printf "PLATFORM=%s\\nUSERNAME=%s\\n" "$platform" "$username" > "$CONFIG_FILE"

# Detect shell rc file
SHELL_RC="$HOME/.bashrc"
SHELL_NAME="$(basename "$SHELL" 2>/dev/null || echo bash)"
if [ "$SHELL_NAME" = "zsh" ] || [ -n "$ZSH_VERSION" ]; then
  SHELL_RC="$HOME/.zshrc"
fi

# Append r6 function only if not already present
if ! grep -q "r6fetch" "$SHELL_RC" 2>/dev/null; then
  cat >> "$SHELL_RC" << 'SHELLFUNC'

# r6fetch — Rainbow Six Siege stats in your terminal
# https://r6.mosly.dev
r6() {
  _platform="\${1:-$(grep PLATFORM "$HOME/.config/r6fetch/config" 2>/dev/null | cut -d= -f2)}"
  _username="\${2:-$(grep USERNAME "$HOME/.config/r6fetch/config" 2>/dev/null | cut -d= -f2)}"
  if [ -z "$_platform" ] || [ -z "$_username" ]; then
    printf "r6fetch: no default configured. Run: curl r6.mosly.dev/setup | sh\\n"
    return 1
  fi
  curl "r6.mosly.dev/$_platform/$_username"
}
SHELLFUNC
fi

printf "\\n  Done! Config saved to %s\\n" "$CONFIG_FILE"
printf "  Run: source %s\\n" "$SHELL_RC"
printf "  Then: r6\\n\\n"
`;

export function setupRoute(c: Context) {
  return c.text(SETUP_SCRIPT, 200, {
    "Content-Type": "text/plain; charset=utf-8",
  });
}
