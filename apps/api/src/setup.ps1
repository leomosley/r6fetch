# r6fetch setup for PowerShell
$ErrorActionPreference = 'Stop'

$ConfigDir = "$env:USERPROFILE\.config\r6fetch"
$ConfigFile = "$ConfigDir\config"

Write-Host "`n  r6fetch setup`n  ─────────────`n"

$platform = (Read-Host "  Platform (pc / ps / xbox)").Trim().ToLower()
if ($platform -notin @('pc', 'ps', 'xbox')) {
  throw "Platform must be pc, ps, or xbox"
}

$username = (Read-Host "  Username").Trim()
if ([string]::IsNullOrEmpty($username)) {
  throw "Username cannot be empty"
}

New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
"PLATFORM=$platform`nUSERNAME=$username" | Set-Content $ConfigFile

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
  $cfg = "$env:USERPROFILE\.config\r6fetch\config"
  if (-not $Platform -and (Test-Path $cfg)) {
    $Platform = (Get-Content $cfg | Where-Object { $_ -match '^PLATFORM=' }) -replace '^PLATFORM=', ''
  }
  if (-not $Username -and (Test-Path $cfg)) {
    $Username = (Get-Content $cfg | Where-Object { $_ -match '^USERNAME=' }) -replace '^USERNAME=', ''
  }
  if (-not $Platform -or -not $Username) {
    Write-Host "r6fetch: no default configured. Run: iex (irm __R6FETCH_ORIGIN__/setup)"
    return
  }
  $encodedUsername = [Uri]::EscapeDataString($Username)
  Invoke-RestMethod "__R6FETCH_ORIGIN__/$Platform/$encodedUsername"
}
# END r6fetch
'@

Write-Host "`n  Done! Config saved to $ConfigFile"
Write-Host "  Run: . `$PROFILE"
Write-Host "  Then: r6fetch`n"
