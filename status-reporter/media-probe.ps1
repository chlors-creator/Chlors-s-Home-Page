$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskMethods = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object Name -eq 'AsTask'
function Await-WinRt($Operation, [Type]$ResultType) {
  $method = $asTaskMethods | Where-Object { $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1
  $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.Wait()
  return $task.Result
}
try {
  $managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  $manager = Await-WinRt ($managerType::RequestAsync()) $managerType
  $session = $manager.GetSessions() | Where-Object { $_.SourceAppUserModelId -match 'cloudmusic|netease|orpheus' } | Select-Object -First 1
  if ($session) {
    $propertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
    $properties = Await-WinRt ($session.TryGetMediaPropertiesAsync()) $propertiesType
    if ($session.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing' -and $properties.Title) {
      @{ state = 'playing'; song = $properties.Title } | ConvertTo-Json -Compress
      exit
    }
  }
} catch { }
$windowTitle = Get-Process cloudmusic -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -ExpandProperty MainWindowTitle -First 1
if ($windowTitle) {
  $song = ($windowTitle -split '\s+-\s+', 2)[0].Trim()
  if ($song) {
    @{ state = 'playing'; song = $song } | ConvertTo-Json -Compress
    exit
  }
}
@{ state = 'online' } | ConvertTo-Json -Compress
