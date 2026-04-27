@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "APP_DIR=%ROOT%"
set "VENV_PY=%ROOT%.venv\Scripts\python.exe"
set "ROOT=%~dp0"
set "PORT=8000"
set "HOST=0.0.0.0"
set "SETTINGS=security_center_ai.settings"
set "RUNSERVER_FLAGS="
set "DRY_RUN="

if /I "%~1"=="--noreload" set "RUNSERVER_FLAGS=--noreload"
if /I "%~1"=="--dry-run" set "DRY_RUN=1"
if /I "%~2"=="--dry-run" set "DRY_RUN=1"

echo.
echo ==========================================
echo   Riavvio server Django
echo ==========================================
echo Root:     %ROOT%
echo App dir:  %APP_DIR%
echo Python:   %VENV_PY%
echo Porta:    %PORT%
echo Settings: %SETTINGS%
echo.

echo Chiudo eventuali listener attivi sulla porta %PORT%...

set "FOUND_PORT_PID="

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    echo   - stop PID %%P
    taskkill /F /PID %%P >nul 2>&1
    set "FOUND_PORT_PID=1"
)

if not defined FOUND_PORT_PID (
    echo   - nessun listener attivo trovato sulla porta %PORT%
)

echo.
echo Attendo rilascio porta...
timeout /t 1 /nobreak >nul

if not exist "%VENV_PY%" (
    echo.
    echo ERRORE: interprete Python non trovato:
    echo %VENV_PY%
    echo.
    exit /b 1
)

if not exist "%APP_DIR%manage.py" (
    echo.
    echo ERRORE: manage.py non trovato in:
    echo %APP_DIR%
    echo.
    exit /b 1
)

cd /d "%APP_DIR%"

set "DJANGO_SETTINGS_MODULE=%SETTINGS%"

if defined DRY_RUN (
    echo.
    echo Dry run completato. Server non avviato.
    echo.
    exit /b 0
)

echo.
if defined RUNSERVER_FLAGS (
    echo Avvio server Django HTTP su %HOST%:%PORT% con flag: %RUNSERVER_FLAGS%
) else (
    echo Avvio server Django HTTP su %HOST%:%PORT% con autoreload attivo
)

echo.
"%VENV_PY%" manage.py runserver %HOST%:%PORT% %RUNSERVER_FLAGS%

endlocal
