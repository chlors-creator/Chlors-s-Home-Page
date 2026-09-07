@echo off
schtasks /End /TN "NaichunSitePresenceReporter" >nul 2>&1
schtasks /Run /TN "NaichunSitePresenceReporter" >nul 2>&1
if errorlevel 1 (
  powershell.exe -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('Unable to start the presence reporter. Run install.ps1 again.','Presence Reporter')" >nul 2>&1
)
