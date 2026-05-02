@echo off
setlocal

set "ROOT=%~dp0..\.."
pushd "%ROOT%" >nul 2>&1
if errorlevel 1 (
  echo Impossibile entrare nel repository root: %ROOT%
  exit /b 1
)

if not exist "logs" mkdir "logs"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ts=Get-Date -Format 'yyyy-MM-dd HH:mm:ss'; Add-Content -LiteralPath 'logs\\launcher.log' -Value ('[{0}] Richiesta avvio servizio SecurityCenterAI.' -f $ts) -Encoding ASCII"

sc.exe start SecurityCenterAI
set "EXITCODE=%ERRORLEVEL%"

if not "%EXITCODE%"=="0" (
  echo Avvio servizio non riuscito. Verificare installazione servizio e privilegi.
)

popd >nul
endlocal
exit /b %EXITCODE%
