[CmdletBinding()]
param(
    [switch]$SkipDjangoCheck
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $RepoRoot

function Get-LocalEnvValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $processValue = [Environment]::GetEnvironmentVariable($Name, "Process")
    if (![string]::IsNullOrWhiteSpace($processValue)) {
        return $processValue
    }

    $envPath = Join-Path $RepoRoot ".env"
    if (!(Test-Path -LiteralPath $envPath)) {
        return ""
    }

    $line = Get-Content -LiteralPath $envPath |
        Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } |
        Select-Object -First 1

    if (!$line) {
        return ""
    }

    return ($line -split "=", 2)[1].Trim().Trim('"').Trim("'")
}

Write-Host "Security Center AI - controllo profilo SQL Server TEST"
Write-Host ""

$driver = $null
if (Get-Command Get-OdbcDriver -ErrorAction SilentlyContinue) {
    $driver = Get-OdbcDriver -Name "ODBC Driver 18 for SQL Server" -ErrorAction SilentlyContinue
}

if ($driver) {
    Write-Host "ODBC Driver 18 for SQL Server: trovato"
} else {
    Write-Warning "ODBC Driver 18 for SQL Server non trovato. Installarlo prima di usare il profilo SQL Server."
}

Write-Host ""
Write-Host "Configurazione database rilevata (password esclusa):"
$names = @(
    "DB_ENGINE",
    "DB_NAME",
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_TRUSTED_CONNECTION",
    "DB_DRIVER",
    "DB_TRUST_SERVER_CERTIFICATE"
)

foreach ($name in $names) {
    $value = Get-LocalEnvValue -Name $name
    if ([string]::IsNullOrWhiteSpace($value)) {
        $value = "<vuoto>"
    }
    Write-Host ("{0}={1}" -f $name, $value)
}
Write-Host "DB_PASSWORD=<non visualizzata>"

if ($SkipDjangoCheck) {
    Write-Host ""
    Write-Host "Controllo Django saltato per richiesta operatore."
    exit 0
}

Write-Host ""
Write-Host "Eseguo: python manage.py security_db_check"
& python manage.py security_db_check
if ($LASTEXITCODE -ne 0) {
    Write-Error "Controllo database non riuscito. Verificare SQL Server, database, driver ODBC e credenziali."
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Controllo completato."
