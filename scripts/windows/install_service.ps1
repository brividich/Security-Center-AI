[CmdletBinding()]
param(
    [switch]$StartService
)

$ErrorActionPreference = "Stop"

$ServiceName = "SecurityCenterAI"
$DisplayName = "Security Center AI"
$ServiceDescription = "Security Center AI LAN test service"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$EnvPath = Join-Path $RepoRoot ".env"
$VenvPython = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$LogsDir = Join-Path $RepoRoot "logs"
$LauncherLog = Join-Path $LogsDir "launcher.log"
$StdoutLog = Join-Path $LogsDir "service.out.log"
$StderrLog = Join-Path $LogsDir "service.err.log"
$ToolWinSw = Join-Path $RepoRoot "tools\windows\winsw.exe"
$ToolNssm = Join-Path $RepoRoot "tools\windows\nssm.exe"
$DefaultWinSwXmlFileName = "winsw.xml"
$LegacyWinSwXmlPath = Join-Path $RepoRoot "tools\windows\SecurityCenterAI.xml"

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

function Resolve-ServiceWrapper {
    if (Test-Path -LiteralPath $ToolWinSw) {
        return @{ Type = "WinSW"; Path = (Resolve-Path -LiteralPath $ToolWinSw).Path; Source = "app-local" }
    }

    $winswCommand = Get-Command "winsw.exe" -ErrorAction SilentlyContinue
    if ($winswCommand) {
        return @{ Type = "WinSW"; Path = $winswCommand.Source; Source = "PATH" }
    }

    if (Test-Path -LiteralPath $ToolNssm) {
        return @{ Type = "NSSM"; Path = (Resolve-Path -LiteralPath $ToolNssm).Path; Source = "app-local" }
    }

    $nssmCommand = Get-Command "nssm.exe" -ErrorAction SilentlyContinue
    if ($nssmCommand) {
        return @{ Type = "NSSM"; Path = $nssmCommand.Source; Source = "PATH" }
    }

    throw "Nessun wrapper servizio trovato. Copiare winsw.exe in tools\windows\winsw.exe oppure nssm.exe in tools\windows\nssm.exe."
}

function Resolve-PythonCommand {
    if (Test-Path -LiteralPath $VenvPython) {
        return (Resolve-Path -LiteralPath $VenvPython).Path
    }

    $pythonCommand = Get-Command "python" -ErrorAction SilentlyContinue
    if ($pythonCommand) {
        Write-Warning "`.venv\Scripts\python.exe` non trovato. Uso python dal PATH; verificare che Waitress e le dipendenze del progetto siano installate."
        Write-LauncherLog "Avviso: uso python dal PATH per il servizio perche .venv non e disponibile."
        return $pythonCommand.Source
    }

    throw "Python non trovato. Eseguire prima scripts\windows\setup_test_deployment.ps1 oppure installare Python nel PATH."
}

function ConvertTo-XmlText {
    param([AllowEmptyString()][string]$Value)
    return [System.Security.SecurityElement]::Escape($Value)
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

function Write-WinSwXml {
    param(
        [Parameter(Mandatory = $true)][string]$WinSwXmlPath,
        [Parameter(Mandatory = $true)][string]$PythonPath,
        [Parameter(Mandatory = $true)][string]$WaitressArguments
    )

    New-Item -ItemType Directory -Force -Path (Split-Path -Path $WinSwXmlPath -Parent) | Out-Null
    New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

    $xml = @"
<service>
  <id>$ServiceName</id>
  <name>$DisplayName</name>
  <description>$ServiceDescription</description>
  <executable>$(ConvertTo-XmlText -Value $PythonPath)</executable>
  <arguments>$(ConvertTo-XmlText -Value $WaitressArguments)</arguments>
  <workingdirectory>$(ConvertTo-XmlText -Value $RepoRoot.Path)</workingdirectory>
  <startmode>Automatic</startmode>
  <logpath>$(ConvertTo-XmlText -Value $LogsDir)</logpath>
  <log mode="roll-by-size">
    <sizeThreshold>10485760</sizeThreshold>
    <keepFiles>8</keepFiles>
  </log>
  <stoptimeout>15 sec</stoptimeout>
</service>
"@

    Set-Content -LiteralPath $WinSwXmlPath -Value $xml -Encoding UTF8
    if ($WinSwXmlPath -ne $LegacyWinSwXmlPath) {
        Set-Content -LiteralPath $LegacyWinSwXmlPath -Value $xml -Encoding UTF8
    }

    Write-Host "Configurazione WinSW generata: $WinSwXmlPath"
    if ($WinSwXmlPath -ne $LegacyWinSwXmlPath) {
        Write-Host "Copia compatibilita WinSW generata: tools\windows\SecurityCenterAI.xml"
    }
    Write-LauncherLog "Configurazione WinSW generata: $WinSwXmlPath"
}

function Invoke-ExternalCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$FailureMessage
    )

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $output = & $FilePath @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    foreach ($item in $output) {
        $text = ($item | Out-String).TrimEnd()
        if (![string]::IsNullOrWhiteSpace($text)) {
            Write-Host $text
        }
    }

    if ($exitCode -ne 0) {
        throw "$FailureMessage Exit code: $exitCode"
    }
}

function Invoke-WinSw {
    param(
        [Parameter(Mandatory = $true)][string]$WinSwPath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    Invoke-ExternalCommand `
        -FilePath $WinSwPath `
        -Arguments $Arguments `
        -FailureMessage "Comando WinSW non riuscito: $($Arguments -join ' ')."
}

function Invoke-Nssm {
    param(
        [Parameter(Mandatory = $true)][string]$NssmPath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    Invoke-ExternalCommand `
        -FilePath $NssmPath `
        -Arguments $Arguments `
        -FailureMessage "Comando NSSM non riuscito: $($Arguments -join ' ')."
}

function Invoke-Sc {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    Invoke-ExternalCommand `
        -FilePath "sc.exe" `
        -Arguments $Arguments `
        -FailureMessage "Comando sc.exe non riuscito: $($Arguments -join ' ')."
}

function Install-WithWinSw {
    param(
        [Parameter(Mandatory = $true)][string]$WinSwPath,
        [Parameter(Mandatory = $true)][string]$PythonPath,
        [Parameter(Mandatory = $true)][string]$WaitressArguments
    )

    Write-Host "WinSW trovato: $WinSwPath"
    $winSwConfigPath = Get-WinSwXmlPath -WinSwPath $WinSwPath
    Write-WinSwXml -WinSwXmlPath $winSwConfigPath -PythonPath $PythonPath -WaitressArguments $WaitressArguments

    $serviceExists = [bool](Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)
    if (!$serviceExists) {
        Write-Host "Creo servizio $ServiceName con WinSW..."
        Invoke-WinSw -WinSwPath $WinSwPath -Arguments @("install")
        Write-LauncherLog "Servizio creato con WinSW."
    } else {
        Write-Host "Servizio esistente trovato. Aggiorno XML WinSW e configurazione Windows."
        Write-LauncherLog "Servizio gia esistente, XML WinSW aggiornato."
    }

    Invoke-Sc -Arguments @("config", $ServiceName, "start=", "auto")
    Invoke-Sc -Arguments @("description", $ServiceName, $ServiceDescription)
}

function Install-WithNssm {
    param(
        [Parameter(Mandatory = $true)][string]$NssmPath,
        [Parameter(Mandatory = $true)][string]$PythonPath,
        [Parameter(Mandatory = $true)][string]$WaitressArguments
    )

    Write-Host "WinSW non trovato, uso fallback NSSM."
    Write-Host "NSSM trovato: $NssmPath"

    $serviceExists = [bool](Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)
    if (!$serviceExists) {
        Write-Host "Creo servizio $ServiceName con NSSM..."
        Invoke-Nssm -NssmPath $NssmPath -Arguments @("install", $ServiceName, $PythonPath, $WaitressArguments)
        Write-LauncherLog "Servizio creato con NSSM."
    } else {
        Write-Host "Servizio esistente trovato, aggiorno configurazione NSSM..."
        Write-LauncherLog "Servizio gia esistente, aggiorno configurazione NSSM."
    }

    Invoke-Nssm -NssmPath $NssmPath -Arguments @("set", $ServiceName, "Application", $PythonPath)
    Invoke-Nssm -NssmPath $NssmPath -Arguments @("set", $ServiceName, "AppParameters", $WaitressArguments)
    Invoke-Nssm -NssmPath $NssmPath -Arguments @("set", $ServiceName, "AppDirectory", $RepoRoot.Path)
    Invoke-Nssm -NssmPath $NssmPath -Arguments @("set", $ServiceName, "DisplayName", $DisplayName)
    Invoke-Nssm -NssmPath $NssmPath -Arguments @("set", $ServiceName, "Description", $ServiceDescription)
    Invoke-Nssm -NssmPath $NssmPath -Arguments @("set", $ServiceName, "Start", "SERVICE_AUTO_START")
    Invoke-Nssm -NssmPath $NssmPath -Arguments @("set", $ServiceName, "AppStdout", $StdoutLog)
    Invoke-Nssm -NssmPath $NssmPath -Arguments @("set", $ServiceName, "AppStderr", $StderrLog)
    Invoke-Nssm -NssmPath $NssmPath -Arguments @("set", $ServiceName, "AppRotateFiles", "1")
    Invoke-Nssm -NssmPath $NssmPath -Arguments @("set", $ServiceName, "AppRotateOnline", "1")
    Invoke-Nssm -NssmPath $NssmPath -Arguments @("set", $ServiceName, "AppRotateBytes", "10485760")

    Invoke-Sc -Arguments @("description", $ServiceName, $ServiceDescription)
}

function Start-SecurityCenterService {
    Write-Host "Avvio servizio..."
    try {
        Start-Service -Name $ServiceName -ErrorAction Stop
        Start-Sleep -Seconds 2
        $service = Get-Service -Name $ServiceName -ErrorAction Stop
        Write-Host "Stato servizio: $($service.Status)"
        if ($service.Status -ne "Running") {
            throw "Il servizio e stato avviato ma non risulta Running. Stato corrente: $($service.Status)."
        }
        Write-LauncherLog "Servizio avviato dopo installazione."
    } catch {
        Write-Host "Avvio servizio non riuscito."
        $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($service) {
            Write-Host "Stato servizio dopo errore: $($service.Status)"
        }
        Write-Host "Controllare anche:"
        Write-Host "  logs\service.out.log"
        Write-Host "  logs\service.err.log"
        Write-Host "  logs\launcher.log"
        throw
    }
}

Set-Location $RepoRoot

Write-Host "Security Center AI - installazione servizio Windows TEST"
Write-Host "Il servizio usa Waitress ed e destinato solo a LAN di test."
Write-Host "WinSW e preferito; NSSM resta fallback opzionale."

if (!(Test-IsAdministrator)) {
    throw "Installazione servizio richiede PowerShell avviata come Amministratore."
}

if (!(Test-Path -LiteralPath $EnvPath)) {
    throw ".env non trovato. Eseguire configure_sqlserver_env.ps1 oppure creare .env da .env.test-sqlserver.example prima di installare il servizio."
}

$wrapper = Resolve-ServiceWrapper
$pythonPath = Resolve-PythonCommand
$waitressArgs = "-m waitress --host=0.0.0.0 --port=8000 security_center_ai.wsgi:application"

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

if ($wrapper.Type -eq "WinSW") {
    Install-WithWinSw -WinSwPath $wrapper.Path -PythonPath $pythonPath -WaitressArguments $waitressArgs
} else {
    Install-WithNssm -NssmPath $wrapper.Path -PythonPath $pythonPath -WaitressArguments $waitressArgs
}

if ($StartService) {
    Start-SecurityCenterService
}

Write-Host ""
Write-Host "Servizio configurato: $DisplayName ($ServiceName)"
Write-Host "Wrapper servizio: $($wrapper.Type) da $($wrapper.Source)"
Write-Host "URL locale: http://127.0.0.1:8000/"
Write-Host "URL LAN: http://<PC-IP>:8000/"
Write-Host "Log servizio:"
Write-Host "  logs\service.out.log"
Write-Host "  logs\service.err.log"
Write-Host "  logs\launcher.log"
