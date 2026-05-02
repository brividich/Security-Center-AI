@echo off
setlocal

set "ROOT=%~dp0..\.."
pushd "%ROOT%" >nul 2>&1
if errorlevel 1 (
  echo Impossibile entrare nel repository root: %ROOT%
  exit /b 1
)

if "%SC_HOST%"=="" set "SC_HOST=0.0.0.0"
if "%SC_PORT%"=="" set "SC_PORT=8000"

echo Security Center AI - avvio TEST Windows
echo Uso previsto: LAN di test, non Internet.

if not exist ".env" (
  echo .env non trovato. Copiare .env.test-sqlserver.example in .env e configurare DB_HOST / ALLOWED_HOSTS.
  popd >nul
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo Ambiente virtuale non trovato. Eseguire prima .\scripts\windows\setup_test_deployment.ps1
  popd >nul
  exit /b 1
)

call ".venv\Scripts\activate.bat"
if errorlevel 1 (
  echo Attivazione .venv non riuscita.
  popd >nul
  exit /b 1
)

if not exist "runtime" mkdir "runtime"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $root=(Resolve-Path '.').Path; $py=Join-Path $root '.venv\Scripts\python.exe'; $pidFile=Join-Path $root 'runtime\security_center_django.pid'; $urlFile=Join-Path $root 'runtime\security_center.url'; $hostName=$env:SC_HOST; if([string]::IsNullOrWhiteSpace($hostName)){ $hostName='0.0.0.0' }; $port=$env:SC_PORT; if([string]::IsNullOrWhiteSpace($port)){ $port='8000' }; $localUrl=('http://127.0.0.1:{0}/' -f $port); $args=@('manage.py','runserver',('{0}:{1}' -f $hostName,$port),'--noreload'); $process=Start-Process -FilePath $py -ArgumentList $args -WorkingDirectory $root -PassThru -WindowStyle Minimized; Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ASCII; Set-Content -LiteralPath $urlFile -Value $localUrl -Encoding ASCII; Write-Host ('Django avviato. PID: {0}' -f $process.Id)"
if errorlevel 1 (
  echo Avvio non riuscito.
  popd >nul
  exit /b 1
)

echo.
echo URL locale: http://127.0.0.1:%SC_PORT%/
echo URL LAN: http://^<PC-IP^>:%SC_PORT%/
echo Se l'accesso LAN non funziona, verificare ALLOWED_HOSTS e firewall Windows.
echo Per fermare: .\scripts\windows\stop_security_center.bat

popd >nul
endlocal
