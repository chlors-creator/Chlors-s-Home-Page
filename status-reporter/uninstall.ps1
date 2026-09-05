$task = Get-ScheduledTask -TaskName 'NaichunSitePresenceReporter' -ErrorAction SilentlyContinue
if ($task) { Unregister-ScheduledTask -TaskName 'NaichunSitePresenceReporter' -Confirm:$false }
$configPath = Join-Path $PSScriptRoot 'config.json'
if (Test-Path -LiteralPath $configPath) { Remove-Item -LiteralPath $configPath -Force }
Write-Host '状态上报器已卸载。'
