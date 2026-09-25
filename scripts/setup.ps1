$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force '.runtime' | Out-Null
$pgRoot = 'C:/Program Files/PostgreSQL/18/bin'
if (!(Test-Path "$pgRoot/initdb.exe")) { throw 'Instale PostgreSQL 18 para Windows antes de continuar.' }
if (!(Test-Path '.runtime/pgdata/PG_VERSION')) {
 & "$pgRoot/initdb.exe" -D '.runtime/pgdata' -U centinela -A trust --encoding=UTF8 --locale=C
 if ($LASTEXITCODE -ne 0) { throw 'No se pudo inicializar PostgreSQL de laboratorio' }
}
if (!(Test-Path '.env')) {
 @'
DATABASE_URL=postgresql://centinela@127.0.0.1:55432/postgres
PG_BIN=C:/Program Files/PostgreSQL/18/bin
PORT=3001
LAB_MODE=true
'@ | Set-Content '.env'
}
if (!(Test-Path '.runtime/mediamtx.exe')) {
 $release = Invoke-RestMethod 'https://api.github.com/repos/bluenviron/mediamtx/releases/tags/v1.17.0'
 $asset = $release.assets | Where-Object name -eq 'mediamtx_v1.17.0_windows_amd64.zip'
 if (!$asset) { throw 'No se encontró MediaMTX para Windows' }
 Invoke-WebRequest $asset.browser_download_url -OutFile '.runtime/mediamtx.zip'
 Expand-Archive '.runtime/mediamtx.zip' '.runtime/mediamtx-download' -Force
 Copy-Item '.runtime/mediamtx-download/mediamtx.exe' '.runtime/mediamtx.exe'
}
Write-Host 'Laboratorio preparado. Ejecute npm run build y npm start.'
