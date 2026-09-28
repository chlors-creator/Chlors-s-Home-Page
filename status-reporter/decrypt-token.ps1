param([Parameter(Mandatory = $true)][string]$SettingsPath)

$ErrorActionPreference = 'Stop'
$settings = Get-Content -Raw -LiteralPath $SettingsPath | ConvertFrom-Json
if (-not $settings.tokenEncrypted) { throw 'The reporter settings do not contain a protected token.' }

$secure = ConvertTo-SecureString -String $settings.tokenEncrypted
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
