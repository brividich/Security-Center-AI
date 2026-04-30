@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
set "VENV_PY=%ROOT%.venv\Scripts\python.exe"
set "BACKEND_URL=http://127.0.0.1:8000/security/"
set "RUNSERVER_FLAGS="
set "DRY_RUN="

if /I "%~1"=="--noreload" set "RUNSERVER_FLAGS=--noreload"
if /I "%~1"=="--dry-run" set "DRY_RUN=1"
if /I "%~2"=="--dry-run" set "DRY_RUN=1"

cd /d "%ROOT%"

echo.
echo Security Center AI - Backend Restart
echo.

if not exist "%VENV_PY%" (
    echo Virtual environment not found.
    echo Create it with:
    echo python -m venv .venv
    echo .venv\Scripts\python.exe -m pip install -r requirements.txt
    exit /b 1
)

if not exist "%ROOT%manage.py" (
    echo manage.py not found in:
    echo %ROOT%
    exit /b 1
)

if not defined DJANGO_SETTINGS_MODULE set "DJANGO_SETTINGS_MODULE=security_center_ai.settings"
if not defined DJANGO_DEBUG set "DJANGO_DEBUG=True"
if not defined DEBUG set "DEBUG=True"
if not defined DJANGO_ALLOWED_HOSTS set "DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost"
if not defined ALLOWED_HOSTS set "ALLOWED_HOSTS=127.0.0.1,localhost"
if not defined DJANGO_CSRF_TRUSTED_ORIGINS set "DJANGO_CSRF_TRUSTED_ORIGINS=http://127.0.0.1:8000,http://localhost:8000,http://127.0.0.1:5173,http://localhost:5173"
if not defined CSRF_TRUSTED_ORIGINS set "CSRF_TRUSTED_ORIGINS=http://127.0.0.1:8000,http://localhost:8000,http://127.0.0.1:5173,http://localhost:5173"
if not defined CORS_ALLOWED_ORIGINS set "CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173"
if not defined SECURITY_CENTER_DEV_MODE set "SECURITY_CENTER_DEV_MODE=True"

echo Checking backend port...
if defined DRY_RUN (
    echo Dry run: skipping port cleanup.
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\stop_dev_port.ps1" -Port 8000
    timeout /t 1 /nobreak >nul
)

if defined DRY_RUN (
    echo.
    echo Dry run completed. Server not started.
    exit /b 0
)

echo.
echo Starting backend: %BACKEND_URL%
echo.
"%VENV_PY%" manage.py runserver 127.0.0.1:8000 %RUNSERVER_FLAGS%

endlocal
