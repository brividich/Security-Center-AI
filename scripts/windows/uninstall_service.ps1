[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$ServiceName = "SecurityCenterAI"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$LogsDir = Join-Path $RepoRoot "logs"
$LauncherLog = Join-Path $LogsDir "launcher.log"
$ToolWinSw = Join-Path $RepoRoot "tools\windows\winsw.exe"
$DefaultWinSwXmlFileName = "winsw.xml"
$LegacyWinSwXmlPath = Join-Path $RepoRoot "tools\windows\SecurityCenterAI.xml"
$ToolNssm = Join-Path $RepoRoot "tools\windows\nssm.exe"

function Write-LauncherLog {
    param([Parameter(Mandatory = $true)][string]$Message)

    New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -LiteralPath $LauncherLog -Value ("[{0}] {1}" -f $timestamp, $Message) -Encoding ASCII
}

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Resolve-WinSwPath {
    if (Test-Path -LiteralPath $ToolWinSw) {
        return (Resolve-Path -LiteralPath $ToolWinSw).Path
    }

    $command = Get-Command "winsw.exe" -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    return ""
}

function Resolve-NssmPath {
    if (Test-Path -LiteralPath $ToolNssm) {
        return (Resolve-Path -LiteralPath $ToolNssm).Path
    }

    $command = Get-Command "nssm.exe" -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    return ""
}

function Get-WinSwXmlPath {
    param([Parameter(Mandatory = $true)][string]$WinSwPath)

    $winSwDirectory = Split-Path -Path $WinSwPath -Parent
    $winSwBaseName = [System.IO.Path]::GetFileNameWithoutExtension($WinSwPath)
    if ($winSwBaseName -ieq "winsw") {
        return Join-Path $winSwDirectory $DefaultWinSwXmlFileName
    }
    return Join-Path $winSwDirectory ($winSwBaseName + ".xml")
}

function Stop-ServiceIfRunning {
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($service -and $service.Status -ne "Stopped") {
        Write-Host "Fermo servizio $ServiceName..."
        Stop-Service -Name $ServiceName -Force -ErrorAction Stop
        Write-LauncherLog "Servizio fermato prima della rimozione."
    }
}

function Invoke-WinSwUninstall {
    param([Parameter(Mandatory = $true)][string]$WinSwPath)

    $winSwXmlPath = Get-WinSwXmlPath -WinSwPath $WinSwPath
    if (!(Test-Path -LiteralPath $WinSwXmlPath)) {
        if (Test-Path -LiteralPath $LegacyWinSwXmlPath) {
            Copy-Item -LiteralPath $LegacyWinSwXmlPath -Destination $WinSwXmlPath -Force
        } else {
            return $false
        }
    }

    Write-Host "Rimuovo servizio con WinSW..."
    & $WinSwPath uninstall | Out-Host
    if ($LASTEXITCODE -eq 0) {
        Write-LauncherLog "Servizio rimosso con WinSW."
        return $true
    }

    Write-Warning "Rimozione WinSW non riuscita; provo fallback sicuri."
    return $false
}

function Invoke-NssmUninstall {
    param([Parameter(Mandatory = $true)][string]$NssmPath)

    Write-Host "Rimuovo servizio con fallback NSSM..."
    & $NssmPath remove $ServiceName confirm | Out-Host
    if ($LASTEXITCODE -eq 0) {
        Write-LauncherLog "Servizio rimosso con NSSM."
        return $true
    }

    Write-Warning "Rimozione NSSM non riuscita; provo fallback Windows."
    return $false
}

function Invoke-WindowsServiceDelete {
    Write-Host "Rimuovo servizio con sc.exe delete..."
    & sc.exe delete $ServiceName | Out-Host
    if ($LASTEXITCODE -eq 0) {
        Write-LauncherLog "Servizio rimosso con sc.exe delete."
        return $true
    }

    return $false
}

Set-Location $RepoRoot

Write-Host "Security Center AI - rimozione servizio Windows TEST"

if (!(Test-IsAdministrator)) {
    throw "Disinstallazione servizio richiede PowerShell avviata come Amministratore."
}

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (!$service) {
    Write-Host "Servizio $ServiceName non presente."
    Write-LauncherLog "Richiesta rimozione ignorata: servizio assente."
    exit 0
}

Stop-ServiceIfRunning

$removed = $false
$winswPath = Resolve-WinSwPath
if (![string]::IsNullOrWhiteSpace($winswPath)) {
    $removed = Invoke-WinSwUninstall -WinSwPath $winswPath
}

if (!$removed) {
    $nssmPath = Resolve-NssmPath
    if (![string]::IsNullOrWhiteSpace($nssmPath)) {
        $removed = Invoke-NssmUninstall -NssmPath $nssmPath
    }
}

if (!$removed) {
    $removed = Invoke-WindowsServiceDelete
}

if (!$removed) {
    throw "Rimozione servizio non riuscita. Verificare manualmente il servizio $ServiceName."
}

Write-Host "Servizio rimosso: $ServiceName"
