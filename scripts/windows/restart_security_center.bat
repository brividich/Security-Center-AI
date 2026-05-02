@echo off
setlocal

call "%~dp0stop_security_center.bat"
if errorlevel 1 (
  echo Restart interrotto: stop non riuscito.
  exit /b 1
)

call "%~dp0start_security_center.bat"
exit /b %ERRORLEVEL%
