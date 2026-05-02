[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ConfigPath
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$RuntimeDir = Join-Path $RepoRoot "runtime"
$LogPath = Join-Path $RuntimeDir "installer-setup.log"
$ConfigureScript = Join-Path $RepoRoot "scripts\windows\configure_sqlserver_env.ps1"
$SetupScript = Join-Path $RepoRoot "scripts\windows\setup_test_deployment.ps1"
$OpenScript = Join-Path $RepoRoot "scripts\windows\open_security_center.bat"
$SensitiveValues = New-Object System.Collections.Generic.List[string]

function Add-SensitiveValue {
    param([AllowEmptyString()][string]$Value)

    if (![string]::IsNullOrWhiteSpace($Value) -and !$SensitiveValues.Contains($Value)) {
        $SensitiveValues.Add($Value)
    }
}

function Redact-LogValue {
    param([AllowEmptyString()][string]$Value)

    if ($null -eq $Value) {
        return ""
    }

    $redacted = [string]$Value
    foreach ($secretValue in $SensitiveValues) {
        if (![string]::IsNullOrWhiteSpace($secretValue)) {
            $redacted = $redacted.Replace($secretValue, "<masked>")
        }
    }

    $redacted = $redacted -replace "(?i)(DB_PASSWORD|SECRET_KEY|PASSWORD|PWD)\s*=\s*[^;\s,]+", '$1=<masked>'
    $redacted = $redacted -replace "(?i)(DB_PASSWORD|SECRET_KEY|PASSWORD|PWD)\s*:\s*[^;\s,]+", '$1: <masked>'
    return $redacted
}

function Write-Log {
    param([Parameter(Mandatory = $true)][string]$Message)

    $safeMessage = Redact-LogValue -Value $Message
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $safeMessage
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
}

function Add-NamedStringArg {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Arguments,
        [Parameter(Mandatory = $true)][string]$Name,
        [AllowEmptyString()][string]$Value
    )

    if (![string]::IsNullOrWhiteSpace($Value)) {
        $Arguments[$Name] = $Value
    }
}

function Format-ArgumentLog {
    param([Parameter(Mandatory = $true)][hashtable]$Arguments)

    $items = New-Object System.Collections.Generic.List[string]
    foreach ($key in $Arguments.Keys) {
        $value = $Arguments[$key]
        if ($value -is [bool]) {
            if ($value) {
                $items.Add("-$key")
            }
        } else {
            $items.Add("-$key")
            $items.Add([string]$value)
        }
    }

    return Redact-LogValue -Value ($items -join " ")
}

function Invoke-StepScript {
    param(
        [Parameter(Mandatory = $true)][string]$StepName,
        [Parameter(Mandatory = $true)][string]$ScriptPath,
        [Parameter(Mandatory = $true)][hashtable]$Arguments
    )

    Write-Log "$StepName avviato"
    Write-Log "Script: $ScriptPath"
    Write-Log ("Argomenti: " + (Format-ArgumentLog -Arguments $Arguments))

    try {
        $output = & $ScriptPath @Arguments *>&1
        $scriptSucceeded = $?
        foreach ($item in $output) {
            $text = ($item | Out-String).TrimEnd()
            if (![string]::IsNullOrWhiteSpace($text)) {
                Write-Log ("  " + $text)
            }
        }
    } catch {
        $scriptSucceeded = $false
        Write-Log ("  ERRORE STEP: " + $_.Exception.Message)
        if ($_.ScriptStackTrace) {
            Write-Log ("  STACK: " + $_.ScriptStackTrace)
        }
    }

    if (!$scriptSucceeded) {
        throw "$StepName non riuscito. Consultare il log: $LogPath"
    }
    Write-Log "$StepName completato"
}

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
Set-Location $RepoRoot

Write-Log "Setup installer avviato"
Write-Log "Uso previsto: PC di test in LAN, SQL Server TEST, nessuna esposizione Internet."

try {
    if (!(Test-Path -LiteralPath $ConfigPath)) {
        throw "Configurazione installer non trovata."
    }
    if (!(Test-Path -LiteralPath $ConfigureScript)) {
        throw "Script configurazione SQL Server non trovato."
    }
    if (!(Test-Path -LiteralPath $SetupScript)) {
        throw "Script setup TEST non trovato."
    }

    $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    Add-SensitiveValue -Value $config.DbPassword

    Write-Log ("Log dettagliato: " + $LogPath)
    Write-Log ("Repo installata: " + $RepoRoot.Path)
    Write-Log ("Database TEST: " + $config.DbName)
    Write-Log ("Server SQL: " + $config.DbHost)
    Write-Log ("Driver ODBC: " + $config.DbDriver)
    Write-Log ("Trusted Connection: " + $config.TrustedConnection)
    Write-Log ("Crea database: " + $config.CreateDatabase)
    Write-Log ("Dati demo sintetici: " + $config.SeedDemo)
    Write-Log ("Installa servizio: " + $config.InstallService)
    Write-Log ("Skip frontend build: " + $config.SkipFrontendBuild)

    $configureArgs = @{
        Force = $true
        NonInteractive = $true
        SkipDjangoActions = $true
    }
    Add-NamedStringArg -Arguments $configureArgs -Name "DbHost" -Value $config.DbHost
    Add-NamedStringArg -Arguments $configureArgs -Name "DbName" -Value $config.DbName
    Add-NamedStringArg -Arguments $configureArgs -Name "TrustedConnection" -Value $config.TrustedConnection
    Add-NamedStringArg -Arguments $configureArgs -Name "DbUser" -Value $config.DbUser
    Add-NamedStringArg -Arguments $configureArgs -Name "DbDriver" -Value $config.DbDriver
    Add-NamedStringArg -Arguments $configureArgs -Name "TrustServerCertificate" -Value $config.TrustServerCertificate
    Add-NamedStringArg -Arguments $configureArgs -Name "AllowedHosts" -Value $config.AllowedHosts
    Add-NamedStringArg -Arguments $configureArgs -Name "Port" -Value $config.Port
    Add-NamedStringArg -Arguments $configureArgs -Name "DebugMode" -Value "True"

    if ($config.TrustedConnection -eq "False") {
        Add-NamedStringArg -Arguments $configureArgs -Name "DbPassword" -Value $config.DbPassword
    }
    if ($config.CreateDatabase) {
        $configureArgs["CreateDatabase"] = $true
    }

    Invoke-StepScript -StepName "Configurazione SQL Server" -ScriptPath $ConfigureScript -Arguments $configureArgs

    $setupArgs = @{}
    if ($config.SeedDemo) {
        $setupArgs["SeedDemo"] = $true
    }
    if ($config.InstallService) {
        $setupArgs["InstallService"] = $true
    }
    if ($config.SkipFrontendBuild) {
        $setupArgs["SkipFrontendBuild"] = $true
    }
    if ($config.SkipSmokeCheck) {
        $setupArgs["SkipSmokeCheck"] = $true
    }

    Invoke-StepScript -StepName "Setup applicazione" -ScriptPath $SetupScript -Arguments $setupArgs

    if ($config.OpenBrowser -and (Test-Path -LiteralPath $OpenScript)) {
        Write-Log "Apertura browser locale"
        & $OpenScript *> $null
    }

    Write-Log "Setup installer completato"
} catch {
    Write-Log ("ERRORE: " + $_.Exception.Message)
    if ($_.ScriptStackTrace) {
        Write-Log ("STACK: " + $_.ScriptStackTrace)
    }
    throw
} finally {
    if (Test-Path -LiteralPath $ConfigPath) {
        Remove-Item -LiteralPath $ConfigPath -Force -ErrorAction SilentlyContinue
    }
}
