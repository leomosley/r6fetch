import type { Context } from "hono";
import type { Bindings } from "~/bindings";

function buildShScript(origin: string): string {
  return `#!/bin/sh
set -e

CONFIG_DIR="$HOME/.config/r6fetch"
CONFIG_FILE="$CONFIG_DIR/config"

printf "\\n  r6fetch setup\\n  ─────────────\\n\\n"

printf "  Platform (pc / ps / xbox): "
if [ -t 0 ]; then
  read -r platform
else
  read -r platform </dev/tty
fi

case "$platform" in
  pc|ps|xbox) ;;
  *) printf "\\n  Error: platform must be pc, ps, or xbox\\n\\n" && exit 1 ;;
esac

printf "  Username: "
if [ -t 0 ]; then
  read -r username
else
  read -r username </dev/tty
fi

if [ -z "$username" ]; then
  printf "\\n  Error: username cannot be empty\\n\\n" && exit 1
fi

mkdir -p "$CONFIG_DIR"
printf "PLATFORM=%s\\nUSERNAME=%s\\n" "$platform" "$username" > "$CONFIG_FILE"

SHELL_RC="$HOME/.bashrc"
SHELL_NAME="$(basename "$SHELL" 2>/dev/null || echo bash)"
if [ "$SHELL_NAME" = "zsh" ] || [ -n "$ZSH_VERSION" ]; then
  SHELL_RC="$HOME/.zshrc"
fi

if grep -q "# BEGIN r6fetch" "$SHELL_RC" 2>/dev/null; then
  if ! grep -q "# END r6fetch" "$SHELL_RC" 2>/dev/null; then
    printf "\n  Error: incomplete r6fetch block in %s\n\n" "$SHELL_RC"
    exit 1
  fi
  TEMP_FILE="$(mktemp "$SHELL_RC.XXXXXX")"
  sed '/# BEGIN r6fetch/,/# END r6fetch/d' "$SHELL_RC" > "$TEMP_FILE"
  mv "$TEMP_FILE" "$SHELL_RC"
fi

cat >> "$SHELL_RC" << 'SHELLFUNC'

# BEGIN r6fetch
# r6fetch — Rainbow Six Siege stats in your terminal
r6fetch() {
  _platform="\${1:-$(grep '^PLATFORM=' "$HOME/.config/r6fetch/config" 2>/dev/null | cut -d= -f2-)}"
  _username="\${2:-$(grep '^USERNAME=' "$HOME/.config/r6fetch/config" 2>/dev/null | cut -d= -f2-)}"
  if [ -z "$_platform" ] || [ -z "$_username" ]; then
    printf "r6fetch: no default configured. Run: curl -fsSL ${origin}/setup | sh\\n"
    return 1
  fi
  _encoded_username=""
  _remaining_username="$_username"
  LC_ALL=C
  while [ -n "$_remaining_username" ]; do
    _char="\${_remaining_username%"\${_remaining_username#?}"}"
    case "$_char" in
      [a-zA-Z0-9._~-]) _encoded_username="$_encoded_username$_char" ;;
      *) _encoded_username="$_encoded_username$(printf '%%%02X' "'$_char")" ;;
    esac
    _remaining_username="\${_remaining_username#?}"
  done
  curl "${origin}/$_platform/$_encoded_username"
}
# END r6fetch
SHELLFUNC

printf "\\n  Done! Config saved to %s\\n" "$CONFIG_FILE"
printf "  Run: source %s\\n" "$SHELL_RC"
printf "  Then: r6fetch\\n\\n"
`;
}

function buildPsScript(origin: string): string {
  return `# r6fetch setup for PowerShell
$ErrorActionPreference = 'Stop'

$ConfigDir = "$env:USERPROFILE\\.config\\r6fetch"
$ConfigFile = "$ConfigDir\\config"

Write-Host "\`n  r6fetch setup\`n  ─────────────\`n"

$platform = (Read-Host "  Platform (pc / ps / xbox)").Trim().ToLower()
if ($platform -notin @('pc', 'ps', 'xbox')) {
  throw "Platform must be pc, ps, or xbox"
}

$username = (Read-Host "  Username").Trim()
if ([string]::IsNullOrEmpty($username)) {
  throw "Username cannot be empty"
}

New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
"PLATFORM=$platform\`nUSERNAME=$username" | Set-Content $ConfigFile

$profileDir = Split-Path $PROFILE
if ($profileDir) {
  New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
}
if (-not (Test-Path $PROFILE)) {
  New-Item -ItemType File -Force -Path $PROFILE | Out-Null
}

$existing = Get-Content $PROFILE -Raw -ErrorAction SilentlyContinue
if ($existing -match '# BEGIN r6fetch') {
  if ($existing -notmatch '# END r6fetch') {
    throw "Incomplete r6fetch block in $PROFILE"
  }
  $existing = $existing -replace '(?s)\r?\n?# BEGIN r6fetch.*?# END r6fetch\r?\n?', ''
  Set-Content $PROFILE $existing -NoNewline
}

Add-Content $PROFILE @'

# BEGIN r6fetch
# r6fetch — Rainbow Six Siege stats in your terminal
function r6fetch {
  param([string]$Platform, [string]$Username)
  $cfg = "$env:USERPROFILE\\.config\\r6fetch\\config"
  if (-not $Platform -and (Test-Path $cfg)) {
    $Platform = (Get-Content $cfg | Where-Object { $_ -match '^PLATFORM=' }) -replace '^PLATFORM=', ''
  }
  if (-not $Username -and (Test-Path $cfg)) {
    $Username = (Get-Content $cfg | Where-Object { $_ -match '^USERNAME=' }) -replace '^USERNAME=', ''
  }
  if (-not $Platform -or -not $Username) {
    Write-Host "r6fetch: no default configured. Run: iex (irm ${origin}/setup)"
    return
  }
  $encodedUsername = [Uri]::EscapeDataString($Username)
  Invoke-RestMethod "${origin}/$Platform/$encodedUsername"
}
# END r6fetch
'@

Write-Host "\`n  Done! Config saved to $ConfigFile"
Write-Host "  Run: . \`$PROFILE"
Write-Host "  Then: r6fetch\`n"
`;
}

function isValidDomain(domain: string): boolean {
  return /^(?:localhost(?::\d+)?|127\.0\.0\.1(?::\d+)?|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})$/i.test(
    domain
  );
}

export function setupRoute(c: Context<{ Bindings: Bindings }>): Response {
  if (!isValidDomain(c.env.DOMAIN)) {
    return c.text("\n  Setup is temporarily unavailable.\n  Try again in a moment.\n\n", 503);
  }

  const ua = c.req.header("user-agent") ?? "";
  const isPs = /powershell/i.test(ua);
  const protocol =
    c.env.DOMAIN.startsWith("localhost") || c.env.DOMAIN.startsWith("127.0.0.1") ? "http" : "https";
  const origin = `${protocol}://${c.env.DOMAIN}`;
  const script = isPs ? buildPsScript(origin) : buildShScript(origin);
  return c.text(script, 200, {
    "Content-Type": "text/plain; charset=utf-8",
    Vary: "User-Agent",
  });
}
