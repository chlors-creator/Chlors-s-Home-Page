$ErrorActionPreference = 'Stop'
$siteUrl = (Read-Host 'Site URL (for example https://example.com)').Trim()
$token = (Read-Host 'Cloudflare STATUS_REPORT_TOKEN').Trim()
if ($siteUrl -notmatch '^https?://') { throw 'Site URL must start with http:// or https://.' }
if ($token.Length -lt 16) { throw 'The report token must contain at least 16 characters.' }

$configPath = Join-Path $PSScriptRoot 'config.json'
@{ siteUrl = $siteUrl.TrimEnd('/'); token = $token } | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
$reporter = Join-Path $PSScriptRoot 'reporter.cjs'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$reporter`" `"$configPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'NaichunSitePresenceReporter' -Action $action -Trigger $trigger -Settings $settings -Description 'Report local Steam and NetEase Music presence to the personal site' -Force | Out-Null
Start-ScheduledTask -TaskName 'NaichunSitePresenceReporter'
Write-Host 'Installed. The presence reporter is running in the background.'
