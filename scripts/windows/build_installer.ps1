[CmdletBinding()]
param(
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$DistRoot = Join-Path $RepoRoot "dist"
$InstallerOutputDir = Join-Path $DistRoot "installer"
$IssPath = Join-Path $RepoRoot "installer\windows\SecurityCenterAI-Test.iss"
$PackageScript = Join-Path $RepoRoot "scripts\windows\package_test_deployment.ps1"

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [string]$WorkingDirectory = ""
    )

    if (![string]::IsNullOrWhiteSpace($WorkingDirectory)) {
        Push-Location $WorkingDirectory
        try {
            & $FilePath @Arguments
        } finally {
            Pop-Location
        }
    } else {
        & $FilePath @Arguments
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Comando non riuscito: $FilePath $($Arguments -join ' ')"
    }
}

function Get-ProjectVersion {
    if (![string]::IsNullOrWhiteSpace($Version) -and $Version -notin @("latest", "current")) {
        return $Version
    }

    $packageJsonPath = Join-Path $RepoRoot "frontend\package.json"
    if (Test-Path -LiteralPath $packageJsonPath) {
        $packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
        if (![string]::IsNullOrWhiteSpace($packageJson.version)) {
            return $packageJson.version
        }
    }

    $readmePath = Join-Path $RepoRoot "README.md"
    if (Test-Path -LiteralPath $readmePath) {
        $readme = Get-Content -LiteralPath $readmePath -Raw
        if ($readme -match "Current version:\s*([0-9]+\.[0-9]+\.[0-9]+)") {
            return $Matches[1]
        }
    }

    throw "Versione non trovata. Rieseguire con -Version <x.y.z>."
}

function Resolve-IsccPath {
    if (![string]::IsNullOrWhiteSpace($env:INNO_SETUP_ISCC)) {
        if (Test-Path -LiteralPath $env:INNO_SETUP_ISCC) {
            return (Resolve-Path -LiteralPath $env:INNO_SETUP_ISCC).Path
        }
        throw "INNO_SETUP_ISCC e impostato ma ISCC.exe non esiste nel percorso indicato."
    }

    $pathCommand = Get-Command "ISCC.exe" -ErrorAction SilentlyContinue
    if ($pathCommand) {
        return $pathCommand.Source
    }

    $candidatePaths = @(
        (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"),
        (Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 5\ISCC.exe"),
        (Join-Path $env:ProgramFiles "Inno Setup 5\ISCC.exe")
    )

    foreach ($candidate in $candidatePaths) {
        if (![string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw "ISCC.exe non trovato. Installare Inno Setup 6 oppure impostare INNO_SETUP_ISCC con il percorso completo di ISCC.exe."
}

function Test-SafeVersion {
    param([Parameter(Mandatory = $true)][string]$Value)

    return $Value -match "^[0-9]+\.[0-9]+\.[0-9]+([A-Za-z0-9._-]*)?$"
}

Set-Location $RepoRoot

Write-Host "Security Center AI - build installer Windows TEST"
Write-Host "Uso previsto: deployment TEST in LAN, non produzione hardened."

if (!(Test-Path -LiteralPath $IssPath)) {
    throw "Script Inno Setup non trovato: $IssPath"
}

if (!(Test-Path -LiteralPath $PackageScript)) {
    throw "Script pacchetto TEST non trovato: $PackageScript"
}

$resolvedVersion = Get-ProjectVersion
if (!(Test-SafeVersion -Value $resolvedVersion)) {
    throw "Versione non valida per nome installer: $resolvedVersion"
}

$packageRoot = Join-Path $DistRoot "SecurityCenterAI-Test-$resolvedVersion"
if (!(Test-Path -LiteralPath $packageRoot)) {
    Write-Host "Pacchetto TEST non trovato: $packageRoot"
    Write-Host "Creo il pacchetto con scripts\windows\package_test_deployment.ps1..."
    Invoke-CheckedCommand -FilePath "powershell" -Arguments @(
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        $PackageScript,
        "-Version",
        $resolvedVersion
    )
}

if (!(Test-Path -LiteralPath $packageRoot)) {
    throw "Pacchetto TEST ancora assente. Eseguire: powershell -ExecutionPolicy Bypass -File .\scripts\windows\package_test_deployment.ps1 -Version $resolvedVersion"
}

$packageWinSwPath = Join-Path $packageRoot "tools\windows\winsw.exe"
$packageNssmPath = Join-Path $packageRoot "tools\windows\nssm.exe"
if (Test-Path -LiteralPath $packageWinSwPath) {
    Write-Host "WinSW incluso nell'installer da: tools\windows\winsw.exe"
} elseif (Test-Path -LiteralPath $packageNssmPath) {
    Write-Warning "WinSW non trovato nel pacchetto: l'installer usera NSSM come fallback per il servizio."
    Write-Host "NSSM incluso nell'installer da: tools\windows\nssm.exe"
} else {
    Write-Warning "Nessun wrapper servizio trovato nel pacchetto: l'installer puo essere creato, ma l'installazione del servizio richiedera winsw.exe o nssm.exe."
}

New-Item -ItemType Directory -Force -Path $InstallerOutputDir | Out-Null

$isccPath = Resolve-IsccPath
$issDirectory = Split-Path -Path $IssPath -Parent
$installerPath = Join-Path $InstallerOutputDir "SecurityCenterAI-Setup-$resolvedVersion.exe"

Write-Host "ISCC: $isccPath"
Write-Host "Pacchetto sorgente: $packageRoot"
Write-Host "Output installer: $installerPath"

Invoke-CheckedCommand -FilePath $isccPath -Arguments @(
    "/DAppVersion=""$resolvedVersion""",
    "SecurityCenterAI-Test.iss"
) -WorkingDirectory $issDirectory

if (!(Test-Path -LiteralPath $installerPath)) {
    throw "Build completata ma installer non trovato nel percorso atteso: $installerPath"
}

Write-Host ""
Write-Host "Installer creato: $installerPath"
