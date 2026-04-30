$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$FrontendDir = Join-Path $RepoRoot "frontend"
$NodeModulesDir = Join-Path $FrontendDir "node_modules"
$IndexHtml = Join-Path $FrontendDir "dist\index.html"

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string] $FilePath,
        [Parameter(Mandatory = $true)]
        [string[]] $Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $FilePath $($Arguments -join ' ')"
    }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js non trovato. Installa Node.js prima di compilare il frontend."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm non trovato. Installa npm prima di compilare il frontend."
}

Push-Location $RepoRoot
try {
    if (-not (Test-Path $NodeModulesDir)) {
        Write-Host "Dipendenze frontend mancanti: eseguo npm install..."
        Invoke-CheckedCommand -FilePath "npm" -Arguments @("--prefix", "frontend", "install")
    }

    Write-Host "Compilo il frontend React per Django..."
    Invoke-CheckedCommand -FilePath "npm" -Arguments @("--prefix", "frontend", "run", "build")

    if (-not (Test-Path $IndexHtml)) {
        throw "Build completata ma frontend/dist/index.html non e stato trovato."
    }

    Write-Host ""
    Write-Host "Build frontend pronta per Django."
    Write-Host "Prossimi passi:"
    Write-Host "  python manage.py runserver 0.0.0.0:8000"
    Write-Host "  Apri http://127.0.0.1:8000/"
}
finally {
    Pop-Location
}
