@echo off
setlocal

set "ROOT=%~dp0..\.."
pushd "%ROOT%" >nul 2>&1
if errorlevel 1 (
  echo Impossibile entrare nel repository root: %ROOT%
  exit /b 1
)

sc.exe query SecurityCenterAI
set "EXITCODE=%ERRORLEVEL%"

if "%EXITCODE%"=="0" (
  echo.
  echo Log:
  echo   logs\service.out.log
  echo   logs\service.err.log
  echo   logs\launcher.log
)

popd >nul
endlocal
exit /b %EXITCODE%
