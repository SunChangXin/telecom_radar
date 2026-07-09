$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Radar = Join-Path $ProjectRoot ".venv\Scripts\telecom-radar.exe"
$Log = Join-Path $ProjectRoot "data\scheduler.log"

Set-Location $ProjectRoot
& $Radar run-once --print *>> $Log
exit $LASTEXITCODE
