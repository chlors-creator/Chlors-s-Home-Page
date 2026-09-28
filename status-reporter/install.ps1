$ErrorActionPreference = 'Stop'
$siteUrl = (Read-Host 'Status API URL (for example https://status.example.com)').Trim()
$secureToken = Read-Host 'Cloudflare STATUS_REPORT_TOKEN' -AsSecureString
if ($siteUrl -notmatch '^https://') { throw 'Production Site URL must start with https://.' }
if ($secureToken.Length -lt 16) { throw 'The report token must contain at least 16 characters.' }

$settingsDirectory = Join-Path $env:LOCALAPPDATA 'NaichunSitePresenceReporter'
New-Item -ItemType Directory -Path $settingsDirectory -Force | Out-Null
$settingsPath = Join-Path $settingsDirectory 'settings.json'
try {
  $encryptedToken = ConvertFrom-SecureString -SecureString $secureToken
} finally {
  $secureToken.Dispose()
}
@{ siteUrl = $siteUrl.TrimEnd('/'); tokenEncrypted = $encryptedToken } | ConvertTo-Json | Set-Content -LiteralPath $settingsPath -Encoding UTF8
$legacyConfigPath = Join-Path $PSScriptRoot 'config.json'
if (Test-Path -LiteralPath $legacyConfigPath) { Remove-Item -LiteralPath $legacyConfigPath -Force }
$reporter = Join-Path $PSScriptRoot 'reporter.cjs'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$reporter`" `"$settingsPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'NaichunSitePresenceReporter' -Action $action -Trigger $trigger -Settings $settings -Description 'Report local Steam and NetEase Music presence to the personal site' -Force | Out-Null
Start-ScheduledTask -TaskName 'NaichunSitePresenceReporter'
Write-Host 'Installed. The presence reporter is running in the background.'
