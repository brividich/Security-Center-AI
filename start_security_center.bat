@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "VENV_PY=%ROOT%.venv\Scripts\python.exe"
set "BACKEND_URL=http://127.0.0.1:8000/security/"
set "FRONTEND_URL=http://127.0.0.1:5173/"
set "FRONTEND_STARTED="
set "DRY_RUN="
set "NODE_EXE="
set "NPM_CMD="

if /I "%~1"=="--dry-run" set "DRY_RUN=1"

cd /d "%ROOT%"

echo.
echo Security Center AI - Developer Startup
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

echo Checking development ports...
if defined DRY_RUN (
    echo Dry run: skipping port cleanup.
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\stop_dev_port.ps1" -Port 8000
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\stop_dev_port.ps1" -Port 5173
    timeout /t 1 /nobreak >nul
)

echo.
echo Starting backend: %BACKEND_URL%
if not defined DRY_RUN (
    start "Security Center AI - Backend" /D "%ROOT%" cmd /k ""%VENV_PY%" manage.py runserver 127.0.0.1:8000"
)

if exist "%ROOT%frontend\package.json" (
    for /f "delims=" %%I in ('where node.exe 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%I"
    for /f "delims=" %%I in ('where npm.cmd 2^>nul') do if not defined NPM_CMD set "NPM_CMD=%%I"

    if not defined NODE_EXE if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    if not defined NPM_CMD if exist "C:\Program Files\nodejs\npm.cmd" set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"

    if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
    if not defined NPM_CMD if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"

    if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
    if not defined NPM_CMD if exist "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" set "NPM_CMD=%LOCALAPPDATA%\Programs\nodejs\npm.cmd"

    if defined NODE_EXE (
        echo Node found at: !NODE_EXE!
    ) else (
        echo Node not found
    )
    if defined NPM_CMD (
        echo npm found at: !NPM_CMD!
    ) else (
        echo npm not found
    )

    if not defined NODE_EXE (
        echo.
        echo Warning: Node.js was not found. Skipping React/Vite frontend.
    ) else (
        if not defined NPM_CMD (
            echo.
            echo Warning: npm was not found. Skipping React/Vite frontend.
        ) else (
            echo.
            "!NODE_EXE!" --version
            call "!NPM_CMD!" --version
            if not exist "%ROOT%frontend\node_modules" (
                if defined DRY_RUN (
                    echo Dry run: frontend dependencies would be installed.
                ) else (
                    echo Installing frontend dependencies...
                    pushd "%ROOT%frontend"
                    call "!NPM_CMD!" install
                    if errorlevel 1 (
                        popd
                        echo Warning: npm install failed. Skipping React/Vite frontend.
                        set "FRONTEND_STARTED="
                        goto after_frontend_checks
                    )
                    popd
                )
            )
            echo Starting frontend: %FRONTEND_URL%
            if not defined DRY_RUN (
                start "Security Center AI - Frontend" /D "%ROOT%frontend" cmd /k ""!NPM_CMD!" run dev -- --host 127.0.0.1 --port 5173"
            )
            set "FRONTEND_STARTED=1"
        )
    )
) else (
    echo.
    echo frontend\package.json not found. Skipping React/Vite frontend.
)

:after_frontend_checks

if not defined DRY_RUN (
    if defined FRONTEND_STARTED (
        start "" "%FRONTEND_URL%"
    ) else (
        start "" "%BACKEND_URL%"
    )
)

echo.
echo Backend: %BACKEND_URL%
echo Frontend: %FRONTEND_URL%
if defined DRY_RUN echo Dry run completed. Servers and browser were not started.
echo.

endlocal
