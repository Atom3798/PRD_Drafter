# Start both halves of the app in one window (Windows).
#   .\dev.ps1
# Ctrl+C stops both.
#
# Backend  -> http://localhost:8000
# Frontend -> http://localhost:5173

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

$backendEnv  = Join-Path $root 'backend\.env'
$frontendEnv = Join-Path $root 'frontend\.env'
$venvPython  = Join-Path $root 'backend\.venv\Scripts\python.exe'

if (-not (Test-Path $backendEnv)) {
  Write-Error "backend\.env is missing. Copy backend\.env.example to backend\.env and fill it in."
}
if (-not (Test-Path $frontendEnv)) {
  Write-Error "frontend\.env is missing. Copy frontend\.env.example to frontend\.env and fill it in."
}
if (-not (Test-Path $venvPython)) {
  Write-Error "No virtualenv. Run: cd backend; python -m venv .venv; .venv\Scripts\pip install -r requirements.txt"
}

Write-Host ''
Write-Host '  Backend  -> http://localhost:8000' -ForegroundColor Cyan
Write-Host '  Frontend -> http://localhost:5173' -ForegroundColor Cyan
Write-Host '  Ctrl+C to stop both.' -ForegroundColor DarkGray
Write-Host ''

$backend = Start-Process -FilePath $venvPython `
  -ArgumentList '-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8000' `
  -WorkingDirectory (Join-Path $root 'backend') -NoNewWindow -PassThru

try {
  Push-Location (Join-Path $root 'frontend')
  npm run dev
}
finally {
  Pop-Location
  if ($backend -and -not $backend.HasExited) {
    Write-Host 'Stopping backend...' -ForegroundColor DarkGray
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
  }
}
