@echo off
setlocal

call "%~dp0stop_service.bat"
if errorlevel 1 (
  echo Restart interrotto: stop servizio non riuscito.
  exit /b 1
)

call "%~dp0start_service.bat"
exit /b %ERRORLEVEL%
