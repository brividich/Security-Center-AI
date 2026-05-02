@echo off
setlocal

set "ROOT=%~dp0..\.."
pushd "%ROOT%" >nul 2>&1
if errorlevel 1 (
  echo Impossibile entrare nel repository root: %ROOT%
  exit /b 1
)

if "%SC_PORT%"=="" set "SC_PORT=8000"
if "%SC_URL%"=="" (
  if exist "runtime\security_center.url" (
    set /p SC_URL=<"runtime\security_center.url"
  )
)
if "%SC_URL%"=="" set "SC_URL=http://127.0.0.1:%SC_PORT%/"

echo Apro %SC_URL%
start "" "%SC_URL%"

popd >nul
endlocal
