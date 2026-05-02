[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$OldInstallerVersionsOnly,
    [string]$KeepVersion = "",
    [switch]$IncludeNodeModules,
    [switch]$IncludeLogs,
    [switch]$IncludeEnv,
    [switch]$IncludeLocalTools,
    [switch]$IncludeDatabases,
    [string]$EnvConfirmation = "",
    [string]$DatabaseConfirmation = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

function Write-Action {
    param(
        [Parameter(Mandatory = $true)][string]$Action,
        [Parameter(Mandatory = $true)][string]$Path
    )

    if ($DryRun) {
        Write-Host "DRY RUN: $Action $Path"
    } else {
        Write-Host "$Action $Path"
    }
}

function Test-PathInsideRepo {
    param([Parameter(Mandatory = $true)][string]$Path)

    $repoPath = $RepoRoot.Path.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    return $fullPath.StartsWith($repoPath + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -or
        $fullPath.Equals($repoPath, [System.StringComparison]::OrdinalIgnoreCase)
}

function Remove-GeneratedPath {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [switch]$Recurse,
        [switch]$ContinueOnError
    )

    if (!(Test-Path -LiteralPath $Path)) {
        return
    }

    if (!(Test-PathInsideRepo -Path $Path)) {
        throw "Percorso fuori dal repository, rimozione bloccata: $Path"
    }

    $resolvedPath = (Resolve-Path -LiteralPath $Path).Path
    Write-Action -Action "Remove" -Path $resolvedPath
    if (!$DryRun) {
        try {
            Remove-Item -LiteralPath $resolvedPath -Force -Recurse:$Recurse
        } catch {
            if ($ContinueOnError) {
                Write-Warning ("Rimozione non riuscita: {0}. {1}" -f $resolvedPath, $_.Exception.Message)
            } else {
                throw
            }
        }
    }
}

function Remove-GeneratedFiles {
    param(
        [Parameter(Mandatory = $true)][string]$Pattern,
        [string[]]$ExcludeDirectoryNames = @()
    )

    Get-ChildItem -LiteralPath $RepoRoot -Recurse -Force -File -Filter $Pattern | ForEach-Object {
        $segments = $_.FullName.Substring($RepoRoot.Path.Length).TrimStart("\", "/") -split "[\\/]"
        foreach ($excluded in $ExcludeDirectoryNames) {
            if ($segments -contains $excluded) {
                return
            }
        }

        Remove-GeneratedPath -Path $_.FullName
    }
}

function Remove-GeneratedDirectoriesByName {
    param(
        [Parameter(Mandatory = $true)][string]$DirectoryName,
        [string[]]$ExcludeDirectoryNames = @()
    )

    Get-ChildItem -LiteralPath $RepoRoot -Recurse -Force -Directory -Filter $DirectoryName | ForEach-Object {
        $segments = $_.FullName.Substring($RepoRoot.Path.Length).TrimStart("\", "/") -split "[\\/]"
        foreach ($excluded in $ExcludeDirectoryNames) {
            if ($segments -contains $excluded) {
                return
            }
        }

        Remove-GeneratedPath -Path $_.FullName -Recurse
    }
}

function Confirm-DangerousRemoval {
    param(
        [Parameter(Mandatory = $true)][string]$Expected,
        [Parameter(Mandatory = $true)][string]$Provided,
        [Parameter(Mandatory = $true)][string]$Prompt
    )

    if ($DryRun) {
        return $true
    }

    $value = $Provided
    if ([string]::IsNullOrWhiteSpace($value)) {
        $value = Read-Host $Prompt
    }

    return $value -eq $Expected
}

function Get-ProjectVersion {
    if (![string]::IsNullOrWhiteSpace($KeepVersion)) {
        return $KeepVersion
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

    throw "Versione corrente non trovata. Usare -KeepVersion <x.y.z>."
}

function Remove-OldInstallerVersions {
    $versionToKeep = Get-ProjectVersion
    $distPath = Join-Path $RepoRoot "dist"

    Write-Host "Pulizia vecchie versioni installer. Versione mantenuta: $versionToKeep"

    if (!(Test-Path -LiteralPath $distPath)) {
        Write-Host "Cartella dist assente, nulla da pulire."
        return
    }

    Get-ChildItem -LiteralPath $distPath -Force | Where-Object {
        ($_.PSIsContainer -and $_.Name -like "SecurityCenterAI-Test-*" -and $_.Name -ne "SecurityCenterAI-Test-$versionToKeep") -or
        (!$_.PSIsContainer -and $_.Name -like "SecurityCenterAI-Test-*.zip" -and $_.Name -ne "SecurityCenterAI-Test-$versionToKeep.zip") -or
        ($_.PSIsContainer -and $_.Name -like "installer-*" -and $_.Name -ne "installer")
    } | ForEach-Object {
        Remove-GeneratedPath -Path $_.FullName -Recurse:$_.PSIsContainer -ContinueOnError
    }

    $installerDir = Join-Path $distPath "installer"
    if (Test-Path -LiteralPath $installerDir) {
        Get-ChildItem -LiteralPath $installerDir -Force -File -Filter "SecurityCenterAI-Setup-*.exe" | Where-Object {
            $_.Name -ne "SecurityCenterAI-Setup-$versionToKeep.exe"
        } | ForEach-Object {
            Remove-GeneratedPath -Path $_.FullName -ContinueOnError
        }
    }
}

Set-Location $RepoRoot

Write-Host "Security Center AI - pulizia artefatti generati"
Write-Host "Repository: $($RepoRoot.Path)"

if ($OldInstallerVersionsOnly) {
    Remove-OldInstallerVersions
    Write-Host "Pulizia completata."
    return
}

Remove-GeneratedPath -Path (Join-Path $RepoRoot "dist") -Recurse
Remove-GeneratedPath -Path (Join-Path $RepoRoot "frontend\dist") -Recurse
Remove-GeneratedPath -Path (Join-Path $RepoRoot ".pytest_cache") -Recurse

Remove-GeneratedDirectoriesByName -DirectoryName "__pycache__" -ExcludeDirectoryNames @(".git", ".venv", "venv", "node_modules", "security_raw_inbox")
Remove-GeneratedFiles -Pattern "*.pyc" -ExcludeDirectoryNames @(".git", ".venv", "venv", "node_modules", "security_raw_inbox")

if ($IncludeNodeModules) {
    Remove-GeneratedPath -Path (Join-Path $RepoRoot "frontend\node_modules") -Recurse
    Remove-GeneratedPath -Path (Join-Path $RepoRoot "node_modules") -Recurse
} else {
    Write-Host "Skip node_modules: usare -IncludeNodeModules per rimuoverli."
}

if ($IncludeLogs) {
    Remove-GeneratedPath -Path (Join-Path $RepoRoot "logs") -Recurse
} else {
    Write-Host "Skip logs: usare -IncludeLogs per rimuoverli."
}

if ($IncludeEnv) {
    if (Confirm-DangerousRemoval -Expected "DELETE LOCAL ENV" -Provided $EnvConfirmation -Prompt "Digitare DELETE LOCAL ENV per rimuovere .env") {
        Remove-GeneratedPath -Path (Join-Path $RepoRoot ".env")
    } else {
        Write-Host "Conferma .env non valida. .env non rimosso."
    }
} else {
    Write-Host "Skip .env: non viene mai rimosso senza -IncludeEnv e conferma."
}

if ($IncludeLocalTools) {
    Remove-GeneratedPath -Path (Join-Path $RepoRoot "tools\windows\winsw.exe")
    Remove-GeneratedPath -Path (Join-Path $RepoRoot "tools\windows\nssm.exe")
    Remove-GeneratedPath -Path (Join-Path $RepoRoot "tools\windows\winsw.xml")
    Remove-GeneratedPath -Path (Join-Path $RepoRoot "tools\windows\SecurityCenterAI.xml")
} else {
    Write-Host "Skip strumenti locali: winsw.exe, nssm.exe, winsw.xml e SecurityCenterAI.xml non vengono rimossi senza -IncludeLocalTools."
}

if ($IncludeDatabases) {
    if (Confirm-DangerousRemoval -Expected "DELETE LOCAL DATABASES" -Provided $DatabaseConfirmation -Prompt "Digitare DELETE LOCAL DATABASES per rimuovere database locali") {
        Remove-GeneratedPath -Path (Join-Path $RepoRoot "db.sqlite3")
        Remove-GeneratedFiles -Pattern "*.sqlite3" -ExcludeDirectoryNames @(".git", ".venv", "venv", "node_modules", "security_raw_inbox")
        Remove-GeneratedFiles -Pattern "*.db" -ExcludeDirectoryNames @(".git", ".venv", "venv", "node_modules", "security_raw_inbox")
    } else {
        Write-Host "Conferma database non valida. Database locali non rimossi."
    }
} else {
    Write-Host "Skip database locali: usare -IncludeDatabases con conferma forte per rimuoverli."
}

Write-Host "Pulizia completata."
