# Comandos de desenvolvimento para Windows sem Docker/make. Uso: .\tasks.ps1 <comando>
param([Parameter(Position = 0)][string]$Cmd = "help")
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Py = Join-Path $Root "apps\api\.venv\Scripts\python.exe"
# Variavel herdada de uma instalacao antiga do PostgreSQL parte o pip/npm.
if ($env:CURL_CA_BUNDLE -and -not (Test-Path $env:CURL_CA_BUNDLE)) { Remove-Item Env:CURL_CA_BUNDLE }

function Invoke-Api {
  Push-Location "$Root\apps\api"
  try { & $Py @args; if ($LASTEXITCODE) { exit $LASTEXITCODE } } finally { Pop-Location }
}
function Invoke-Npm {
  Push-Location $Root
  try { & npm.cmd @args; if ($LASTEXITCODE) { exit $LASTEXITCODE } } finally { Pop-Location }
}

switch ($Cmd) {
  "setup" {
    if (-not (Test-Path $Py)) { python -m venv "$Root\apps\api\.venv" }
    Invoke-Api -m pip install -q -r requirements-dev.txt
    if (-not (Test-Path "$Root\apps\api\.env")) { Copy-Item "$Root\apps\api\.env.example" "$Root\apps\api\.env" }
    Invoke-Api manage.py migrate
    Invoke-Npm install --no-audit --no-fund
  }
  "up" {
    Invoke-Api manage.py migrate
    Start-Process -FilePath $Py -ArgumentList "manage.py runserver 8000" -WorkingDirectory "$Root\apps\api"
    Invoke-Npm run dev:web
  }
  "test"       { Invoke-Api -m pytest -q }
  "lint"       { Invoke-Api -m ruff check .; Invoke-Api -m ruff format --check .; Invoke-Npm run lint:web; Invoke-Npm run typecheck -w apps/web }
  "format"     { Invoke-Api -m ruff format .; Invoke-Api -m ruff check --fix . }
  "migrate"    { Invoke-Api manage.py migrate }
  "gen-client" { Invoke-Api manage.py spectacular --file ..\..\packages\api-client\openapi.yaml; Invoke-Npm run gen:client }
  "seed-demo"  { Invoke-Api manage.py seed_demo }
  "demo" {
    # Base nova só em dev (SQLite): o ledger é append-only e não se "limpa".
    $db = Join-Path $Root "apps\api\db.sqlite3"
    if (Test-Path $db) { Remove-Item $db }
    Invoke-Api manage.py migrate
    Invoke-Api manage.py prepare_demo
  }
  default      { Write-Host "Comandos: setup, up, demo, test, lint, format, migrate, gen-client, seed-demo" }
}
