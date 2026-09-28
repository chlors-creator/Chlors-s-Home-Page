$task = Get-ScheduledTask -TaskName 'NaichunSitePresenceReporter' -ErrorAction SilentlyContinue
if ($task) { Unregister-ScheduledTask -TaskName 'NaichunSitePresenceReporter' -Confirm:$false }
$configPath = Join-Path $PSScriptRoot 'config.json'
if (Test-Path -LiteralPath $configPath) { Remove-Item -LiteralPath $configPath -Force }
$settingsPath = Join-Path $env:LOCALAPPDATA 'NaichunSitePresenceReporter\settings.json'
if (Test-Path -LiteralPath $settingsPath) { Remove-Item -LiteralPath $settingsPath -Force }
Write-Host 'The presence reporter has been uninstalled.'

