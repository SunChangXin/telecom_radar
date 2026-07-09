$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $ProjectRoot
& ".\.venv\Scripts\telecom-radar-web.exe" --host 127.0.0.1 --port 8765
