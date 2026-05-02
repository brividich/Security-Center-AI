[CmdletBinding()]
param(
    [string]$Version = "",
    [switch]$Zip,
    [switch]$Force,
    [switch]$SkipFrontendBuild
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$DistRoot = Join-Path $RepoRoot "dist"

$ExcludedDirectoryNames = @(
    ".git",
    ".venv",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    "logs",
    "media",
    "uploads",
    "attachments",
    "reports",
    "mailbox",
    "inbox",
    "security_raw_inbox",
    "runtime",
    "tests"
)

$ExcludedFileNames = @(
    ".env",
    "db.sqlite3",
    "config.ini",
    "secrets.json",
    "credentials.json",
    "token.json",
    "winsw.xml",
    "SecurityCenterAI.xml"
)

$ExcludedFileExtensions = @(
    ".key",
    ".pem",
    ".pfx",
    ".p12",
    ".cer",
    ".crt",
    ".exe",
    ".sqlite3",
    ".db",
    ".bak",
    ".dump",
    ".log"
)

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Comando non riuscito: $FilePath $($Arguments -join ' ')"
    }
}

function Get-PackageVersion {
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

    return "unknown"
}

function Test-ExcludedRelativePath {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][bool]$IsDirectory
    )

    $segments = $RelativePath -split "[\\/]"
    foreach ($segment in $segments) {
        if ($ExcludedDirectoryNames -contains $segment) {
            return $true
        }
    }

    $leaf = Split-Path -Path $RelativePath -Leaf
    if (!$IsDirectory) {
        if ($ExcludedFileNames -contains $leaf) {
            return $true
        }

        $extension = [System.IO.Path]::GetExtension($leaf)
        if ($ExcludedFileExtensions -contains $extension) {
            return $true
        }
    }

    return $false
}

function Copy-TreeFiltered {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if (!(Test-Path -LiteralPath $Source)) {
        Write-Host "Sorgente assente, salto: $Source"
        return
    }

    $sourceRoot = (Resolve-Path -LiteralPath $Source).Path
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null

    Get-ChildItem -LiteralPath $sourceRoot -Recurse -Force | ForEach-Object {
        $relative = $_.FullName.Substring($sourceRoot.Length).TrimStart([char[]]"\/")
        if ([string]::IsNullOrWhiteSpace($relative)) {
            return
        }

        if (Test-ExcludedRelativePath -RelativePath $relative -IsDirectory $_.PSIsContainer) {
            return
        }

        $target = Join-Path $Destination $relative
        if ($_.PSIsContainer) {
            New-Item -ItemType Directory -Force -Path $target | Out-Null
        } else {
            $targetParent = Split-Path -Path $target -Parent
            New-Item -ItemType Directory -Force -Path $targetParent | Out-Null
            Copy-Item -LiteralPath $_.FullName -Destination $target -Force
        }
    }
}

Set-Location $RepoRoot

Write-Host "Security Center AI - creazione pacchetto TEST Windows"
Write-Host "Il pacchetto e per LAN di test, non per produzione o Internet."

if (!$SkipFrontendBuild) {
    if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm non trovato. Installare Node.js LTS o rieseguire con -SkipFrontendBuild se frontend/dist e gia pronto."
    }
    Invoke-CheckedCommand -FilePath "npm" -Arguments @("--prefix", "frontend", "run", "build")
}

$frontendIndex = Join-Path $RepoRoot "frontend\dist\index.html"
if (!(Test-Path -LiteralPath $frontendIndex)) {
    throw "frontend/dist/index.html non trovato. Eseguire npm --prefix frontend run build prima del packaging."
}

$resolvedVersion = Get-PackageVersion
$packageName = "SecurityCenterAI-Test-$resolvedVersion"
$packageRoot = Join-Path $DistRoot $packageName

New-Item -ItemType Directory -Force -Path $DistRoot | Out-Null

if (Test-Path -LiteralPath $packageRoot) {
    if (!$Force) {
        throw "La cartella pacchetto esiste gia: $packageRoot. Usare -Force per ricrearla."
    }

    $resolvedDist = (Resolve-Path -LiteralPath $DistRoot).Path
    $resolvedPackage = (Resolve-Path -LiteralPath $packageRoot).Path
    if (!$resolvedPackage.StartsWith($resolvedDist, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Percorso pacchetto non sicuro: $resolvedPackage"
    }
    Remove-Item -LiteralPath $packageRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null

Copy-Item -LiteralPath (Join-Path $RepoRoot "manage.py") -Destination $packageRoot -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "requirements.txt") -Destination $packageRoot -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot ".env.test-sqlserver.example") -Destination $packageRoot -Force
if (Test-Path -LiteralPath (Join-Path $RepoRoot "README.md")) {
    Copy-Item -LiteralPath (Join-Path $RepoRoot "README.md") -Destination $packageRoot -Force
}

Copy-TreeFiltered -Source (Join-Path $RepoRoot "security") -Destination (Join-Path $packageRoot "security")
Copy-TreeFiltered -Source (Join-Path $RepoRoot "security_center_ai") -Destination (Join-Path $packageRoot "security_center_ai")
Copy-TreeFiltered -Source (Join-Path $RepoRoot "templates") -Destination (Join-Path $packageRoot "templates")
Copy-TreeFiltered -Source (Join-Path $RepoRoot "frontend\dist") -Destination (Join-Path $packageRoot "frontend\dist")
Copy-TreeFiltered -Source (Join-Path $RepoRoot "docs\security-center") -Destination (Join-Path $packageRoot "docs\security-center")
Copy-TreeFiltered -Source (Join-Path $RepoRoot "scripts\windows") -Destination (Join-Path $packageRoot "scripts\windows")
Copy-TreeFiltered -Source (Join-Path $RepoRoot "tools\windows") -Destination (Join-Path $packageRoot "tools\windows")

$repoWinSwPath = Join-Path $RepoRoot "tools\windows\winsw.exe"
$repoWinSwX64Path = Join-Path $RepoRoot "tools\windows\WinSW-x64.exe"
$packageWinSwPath = Join-Path $packageRoot "tools\windows\winsw.exe"
$hasWinSw = Test-Path -LiteralPath $repoWinSwPath
if ($hasWinSw) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Path $packageWinSwPath -Parent) | Out-Null
    Copy-Item -LiteralPath $repoWinSwPath -Destination $packageWinSwPath -Force
    Write-Host "WinSW incluso nel pacchetto: tools\windows\winsw.exe"
}

if (!$hasWinSw) {
    Write-Warning "WinSW non trovato: il servizio Windows usera NSSM se disponibile, altrimenti l'installazione del servizio non sara possibile."
    if (Test-Path -LiteralPath $repoWinSwX64Path) {
        Write-Warning "Trovato tools\windows\WinSW-x64.exe, ma non verra incluso. Copiare o rinominare il binario verificato in tools\windows\winsw.exe."
    }
}

$repoNssmPath = Join-Path $RepoRoot "tools\windows\nssm.exe"
$packageNssmPath = Join-Path $packageRoot "tools\windows\nssm.exe"
$hasNssm = Test-Path -LiteralPath $repoNssmPath
if ($hasNssm) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Path $packageNssmPath -Parent) | Out-Null
    Copy-Item -LiteralPath $repoNssmPath -Destination $packageNssmPath -Force
    Write-Host "NSSM incluso nel pacchetto come fallback: tools\windows\nssm.exe"
}

if (!$hasWinSw -and !$hasNssm) {
    Write-Warning "Nessun wrapper servizio trovato: copiare winsw.exe in tools\windows\winsw.exe oppure nssm.exe in tools\windows\nssm.exe prima di installare il servizio."
}

if ($Zip) {
    $zipPath = Join-Path $DistRoot "$packageName.zip"
    if (Test-Path -LiteralPath $zipPath) {
        if (!$Force) {
            throw "ZIP esistente: $zipPath. Usare -Force per sovrascrivere."
        }
        Remove-Item -LiteralPath $zipPath -Force
    }
    Compress-Archive -Path (Join-Path $packageRoot "*") -DestinationPath $zipPath
    Write-Host "ZIP creato: $zipPath"
}

Write-Host "Pacchetto creato: $packageRoot"
Write-Host "Controllare .env sul PC di test. Non committare mai .env o dati operativi."
