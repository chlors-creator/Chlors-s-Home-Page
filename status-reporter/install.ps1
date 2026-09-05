$ErrorActionPreference = 'Stop'
$siteUrl = (Read-Host '请输入网站地址（例如 https://example.com）').Trim()
$token = (Read-Host '请输入 Cloudflare STATUS_REPORT_TOKEN').Trim()
if ($siteUrl -notmatch '^https?://') { throw '网站地址必须以 http:// 或 https:// 开头。' }
if ($token.Length -lt 16) { throw '上报密钥至少需要 16 个字符。' }

$configPath = Join-Path $PSScriptRoot 'config.json'
@{ siteUrl = $siteUrl.TrimEnd('/'); token = $token } | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
$reporter = Join-Path $PSScriptRoot 'reporter.ps1.txt'
$escapedReporter = $reporter.Replace("'", "''")
$escapedConfig = $configPath.Replace("'", "''")
$command = "& ([ScriptBlock]::Create((Get-Content -Raw -LiteralPath '$escapedReporter'))) -ConfigPath '$escapedConfig'"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command `"$command`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'NaichunSitePresenceReporter' -Action $action -Trigger $trigger -Settings $settings -Description '向个人网站上报本机 Steam 和网易云状态' -Force | Out-Null
Start-ScheduledTask -TaskName 'NaichunSitePresenceReporter'
Write-Host '安装完成，状态上报器已在后台启动。'
