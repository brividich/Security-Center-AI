@echo off
setlocal

set "ROOT=%~dp0..\.."
pushd "%ROOT%" >nul 2>&1
if errorlevel 1 (
  echo Impossibile entrare nel repository root: %ROOT%
  exit /b 1
)

if "%SC_PORT%"=="" set "SC_PORT=8000"

echo Security Center AI - stop TEST Windows

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $root=(Resolve-Path '.').Path; $pidFile=Join-Path $root 'runtime\security_center_django.pid'; $urlFile=Join-Path $root 'runtime\security_center.url'; $port=$env:SC_PORT; if([string]::IsNullOrWhiteSpace($port)){ $port='8000' }; $stopped=$false; function Test-ManagedDjangoProcess($processInfo){ if(!$processInfo){ return $false }; $cmd=[string]$processInfo.CommandLine; return ($cmd -match 'manage\.py' -and $cmd -match 'runserver') }; if(Test-Path -LiteralPath $pidFile){ $pidText=(Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1); $pidValue=0; if([int]::TryParse($pidText, [ref]$pidValue)){ $processInfo=Get-CimInstance Win32_Process -Filter ('ProcessId = {0}' -f $pidValue) -ErrorAction SilentlyContinue; if(Test-ManagedDjangoProcess $processInfo){ Stop-Process -Id $pidValue -Force; Write-Host ('Processo Django fermato tramite PID {0}.' -f $pidValue); $stopped=$true } else { Write-Host 'PID registrato non corrisponde a un processo Django runserver gestito; non lo fermo.' } } }; if(!$stopped){ $listeners=@(); try { $listeners=Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue } catch { $listeners=@() }; foreach($listener in ($listeners | Sort-Object OwningProcess -Unique)){ $processInfo=Get-CimInstance Win32_Process -Filter ('ProcessId = {0}' -f $listener.OwningProcess) -ErrorAction SilentlyContinue; if(Test-ManagedDjangoProcess $processInfo){ Stop-Process -Id $listener.OwningProcess -Force; Write-Host ('Processo Django fermato sul port {0}, PID {1}.' -f $port, $listener.OwningProcess); $stopped=$true } } }; if($stopped){ Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $urlFile -Force -ErrorAction SilentlyContinue } else { Write-Host ('Nessun runserver Django gestito trovato sul port {0}.' -f $port); Write-Host 'Limitazione: per sicurezza lo script ferma solo processi con command line manage.py runserver.' }"
if errorlevel 1 (
  echo Stop non riuscito.
  popd >nul
  exit /b 1
)

popd >nul
endlocal
