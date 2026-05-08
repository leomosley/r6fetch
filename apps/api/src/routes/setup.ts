import type { Context } from "hono";
import type { Bindings } from "~/bindings";

// Served to bash/zsh users: curl <domain>/setup | sh
function buildShScript(domain: string): string {
  return `#!/bin/sh
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

mkdir -p "$CONFIG_DIR"
printf "PLATFORM=%s\\nUSERNAME=%s\\n" "$platform" "$username" > "$CONFIG_FILE"

SHELL_RC="$HOME/.bashrc"
SHELL_NAME="$(basename "$SHELL" 2>/dev/null || echo bash)"
if [ "$SHELL_NAME" = "zsh" ] || [ -n "$ZSH_VERSION" ]; then
  SHELL_RC="$HOME/.zshrc"
fi

if grep -q "# BEGIN r6fetch" "$SHELL_RC" 2>/dev/null; then
  sed '/# BEGIN r6fetch/,/# END r6fetch/d' "$SHELL_RC" > "$SHELL_RC.tmp" && mv "$SHELL_RC.tmp" "$SHELL_RC"
fi

cat >> "$SHELL_RC" << 'SHELLFUNC'

# BEGIN r6fetch
# r6fetch — Rainbow Six Siege stats in your terminal
r6fetch() {
  _platform="\${1:-$(grep PLATFORM "$HOME/.config/r6fetch/config" 2>/dev/null | cut -d= -f2)}"
  _username="\${2:-$(grep USERNAME "$HOME/.config/r6fetch/config" 2>/dev/null | cut -d= -f2)}"
  if [ -z "$_platform" ] || [ -z "$_username" ]; then
    printf "r6fetch: no default configured. Run: curl ${domain}/setup | sh\\n"
    return 1
  fi
  curl "${domain}/\$_platform/\$_username"
}
# END r6fetch
SHELLFUNC

printf "\\n  Done! Config saved to %s\\n" "$CONFIG_FILE"
printf "  Run: source %s\\n" "$SHELL_RC"
printf "  Then: r6fetch\\n\\n"
`;
}

// Served to PowerShell users: iex (irm <domain>/setup)
// Detected via the PowerShell User-Agent sent by Invoke-RestMethod.
function buildPsScript(domain: string): string {
  return `# r6fetch setup for PowerShell
$ErrorActionPreference = 'Stop'

$ConfigDir = "$env:USERPROFILE\\.config\\r6fetch"
$ConfigFile = "$ConfigDir\\config"

Write-Host "\`n  r6fetch setup\`n  ─────────────\`n"

$platform = (Read-Host "  Platform (pc / ps / xbox)").Trim().ToLower()
if ($platform -notin @('pc', 'ps', 'xbox')) {
  Write-Host "\`n  Error: platform must be pc, ps, or xbox\`n"
  exit 1
}

$username = (Read-Host "  Username").Trim()
if ([string]::IsNullOrEmpty($username)) {
  Write-Host "\`n  Error: username cannot be empty\`n"
  exit 1
}

New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
"PLATFORM=$platform\`nUSERNAME=$username" | Set-Content $ConfigFile

$profileDir = Split-Path $PROFILE
if ($profileDir) { New-Item -ItemType Directory -Force -Path $profileDir | Out-Null }
if (-not (Test-Path $PROFILE)) { New-Item -ItemType File -Force -Path $PROFILE | Out-Null }

$existing = Get-Content $PROFILE -Raw -ErrorAction SilentlyContinue
if ($existing -match '# BEGIN r6fetch') {
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
    Write-Host "r6fetch: no default configured. Run: iex (irm ${domain}/setup)"
    return
  }
  Invoke-RestMethod "${domain}/$Platform/$Username"
}
# END r6fetch
'@

Write-Host "\`n  Done! Config saved to $ConfigFile"
Write-Host "  Run: . \`$PROFILE"
Write-Host "  Then: r6fetch\`n"
`;
}

export function setupRoute(c: Context<{ Bindings: Bindings }>) {
  const ua = c.req.header("user-agent") ?? "";
  const isPs = /powershell/i.test(ua);
  const script = isPs ? buildPsScript(c.env.DOMAIN) : buildShScript(c.env.DOMAIN);
  return c.text(script, 200, {
    "Content-Type": "text/plain; charset=utf-8",
  });
}
