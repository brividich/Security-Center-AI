[CmdletBinding()]
param(
    [switch]$SeedDemo,
    [switch]$SkipFrontendBuild,
    [switch]$SkipSmokeCheck,
    [switch]$InstallService,
    [switch]$ConfigureSqlServer,
    [switch]$CreateDatabase,
    [string]$DbHost = "",
    [string]$DbName = "",
    [string]$TrustedConnection = "",
    [string]$DbUser = "",
    [string]$AllowedHosts = "",
    [string]$Port = "",
    [string]$DebugMode = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$VenvPython = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$EnvPath = Join-Path $RepoRoot ".env"
$RequirementsPath = Join-Path $RepoRoot "requirements.txt"
$FrontendDir = Join-Path $RepoRoot "frontend"
$FrontendNodeModules = Join-Path $FrontendDir "node_modules"
$FrontendPackageLock = Join-Path $FrontendDir "package-lock.json"
$InstallServiceScript = Join-Path $RepoRoot "scripts\windows\install_service.ps1"
$ConfigureSqlServerScript = Join-Path $RepoRoot "scripts\windows\configure_sqlserver_env.ps1"
$ToolWinSw = Join-Path $RepoRoot "tools\windows\winsw.exe"
$ToolNssm = Join-Path $RepoRoot "tools\windows\nssm.exe"

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host ""
    Write-Host "== $Message =="
}

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
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
        throw "Comando non riuscito: $FilePath $($Arguments -join ' ')"
    }
}

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Join-ArgumentList {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    return ($Arguments | ForEach-Object {
        if ($_ -match '[\s"]') {
            '"' + ($_ -replace '"', '\"') + '"'
        } else {
            $_
        }
    }) -join " "
}

function Add-StringArgument {
    param(
        [Parameter(Mandatory = $true)][System.Collections.Generic.List[string]]$Arguments,
        [Parameter(Mandatory = $true)][string]$Name,
        [AllowEmptyString()][string]$Value
    )

    if (![string]::IsNullOrWhiteSpace($Value)) {
        $Arguments.Add($Name)
        $Arguments.Add($Value)
    }
}

function Restart-SelfAsAdministratorIfNeeded {
    $programFiles = [Environment]::GetFolderPath("ProgramFiles")
    $programFilesX86 = [Environment]::GetFolderPath("ProgramFilesX86")
    $repoPath = $RepoRoot.Path
    $isProtectedInstall = $false

    if (![string]::IsNullOrWhiteSpace($programFiles) -and $repoPath.StartsWith($programFiles, [System.StringComparison]::OrdinalIgnoreCase)) {
        $isProtectedInstall = $true
    }
    if (![string]::IsNullOrWhiteSpace($programFilesX86) -and $repoPath.StartsWith($programFilesX86, [System.StringComparison]::OrdinalIgnoreCase)) {
        $isProtectedInstall = $true
    }

    if (!$isProtectedInstall -or (Test-IsAdministrator)) {
        return
    }

    $arguments = New-Object System.Collections.Generic.List[string]
    $arguments.Add("-NoProfile")
    $arguments.Add("-ExecutionPolicy")
    $arguments.Add("Bypass")
    $arguments.Add("-NoExit")
    $arguments.Add("-File")
    $arguments.Add($PSCommandPath)

    if ($SeedDemo) {
        $arguments.Add("-SeedDemo")
    }
    if ($SkipFrontendBuild) {
        $arguments.Add("-SkipFrontendBuild")
    }
    if ($SkipSmokeCheck) {
        $arguments.Add("-SkipSmokeCheck")
    }
    if ($InstallService) {
        $arguments.Add("-InstallService")
    }
    if ($ConfigureSqlServer) {
        $arguments.Add("-ConfigureSqlServer")
    }
    if ($CreateDatabase) {
        $arguments.Add("-CreateDatabase")
    }
    Add-StringArgument -Arguments $arguments -Name "-DbHost" -Value $DbHost
    Add-StringArgument -Arguments $arguments -Name "-DbName" -Value $DbName
    Add-StringArgument -Arguments $arguments -Name "-TrustedConnection" -Value $TrustedConnection
    Add-StringArgument -Arguments $arguments -Name "-DbUser" -Value $DbUser
    Add-StringArgument -Arguments $arguments -Name "-AllowedHosts" -Value $AllowedHosts
    Add-StringArgument -Arguments $arguments -Name "-Port" -Value $Port
    Add-StringArgument -Arguments $arguments -Name "-DebugMode" -Value $DebugMode

    Write-Host "Installazione in Program Files rilevata. Rilancio il setup come amministratore per creare .env, .venv e installare il servizio."
    Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList (Join-ArgumentList -Arguments $arguments.ToArray())
    exit 0
}

function Assert-CommandExists {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$InstallHint
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (!$command) {
        throw "$Name non trovato. $InstallHint"
    }
    return $command
}

function Test-OdbcDriver18 {
    if (Get-Command Get-OdbcDriver -ErrorAction SilentlyContinue) {
        return [bool](Get-OdbcDriver -Name "ODBC Driver 18 for SQL Server" -ErrorAction SilentlyContinue)
    }

    $driverRegistryPath = "HKLM:\SOFTWARE\ODBC\ODBCINST.INI\ODBC Drivers"
    if (Test-Path -LiteralPath $driverRegistryPath) {
        $driverValue = (Get-ItemProperty -LiteralPath $driverRegistryPath -ErrorAction SilentlyContinue)."ODBC Driver 18 for SQL Server"
        return -not [string]::IsNullOrWhiteSpace($driverValue)
    }

    return $false
}

function Resolve-ServiceWrapperForServiceInstall {
    if (Test-Path -LiteralPath $ToolWinSw) {
        return @{ Type = "WinSW"; Path = (Resolve-Path -LiteralPath $ToolWinSw).Path }
    }

    $winswCommand = Get-Command "winsw.exe" -ErrorAction SilentlyContinue
    if ($winswCommand) {
        return @{ Type = "WinSW"; Path = $winswCommand.Source }
    }

    if (Test-Path -LiteralPath $ToolNssm) {
        return @{ Type = "NSSM"; Path = (Resolve-Path -LiteralPath $ToolNssm).Path }
    }

    $command = Get-Command "nssm.exe" -ErrorAction SilentlyContinue
    if ($command) {
        return @{ Type = "NSSM"; Path = $command.Source }
    }

    throw "Nessun wrapper servizio trovato. Copiare winsw.exe in tools\windows\winsw.exe oppure nssm.exe in tools\windows\nssm.exe."
}

Restart-SelfAsAdministratorIfNeeded

Write-Host "Security Center AI - setup deployment TEST Windows"
Write-Host "Uso previsto: PC di test in LAN, SQL Server TEST, nessuna esposizione Internet."

Set-Location $RepoRoot

if ($ConfigureSqlServer) {
    Write-Step "Configurazione guidata SQL Server"
    if (!(Test-Path -LiteralPath $ConfigureSqlServerScript)) {
        throw "Script configure_sqlserver_env.ps1 non trovato: $ConfigureSqlServerScript"
    }

    $configureArgs = @(
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        $ConfigureSqlServerScript,
        "-SkipDjangoActions"
    )

    if ($CreateDatabase) {
        $configureArgs += "-CreateDatabase"
    }
    if (![string]::IsNullOrWhiteSpace($DbHost)) {
        $configureArgs += @("-DbHost", $DbHost)
    }
    if (![string]::IsNullOrWhiteSpace($DbName)) {
        $configureArgs += @("-DbName", $DbName)
    }
    if (![string]::IsNullOrWhiteSpace($TrustedConnection)) {
        $configureArgs += @("-TrustedConnection", $TrustedConnection)
    }
    if (![string]::IsNullOrWhiteSpace($DbUser)) {
        $configureArgs += @("-DbUser", $DbUser)
    }
    if (![string]::IsNullOrWhiteSpace($AllowedHosts)) {
        $configureArgs += @("-AllowedHosts", $AllowedHosts)
    }
    if (![string]::IsNullOrWhiteSpace($Port)) {
        $configureArgs += @("-Port", $Port)
    }
    if (![string]::IsNullOrWhiteSpace($DebugMode)) {
        $configureArgs += @("-DebugMode", $DebugMode)
    }

    Invoke-CheckedCommand -FilePath "powershell" -Arguments $configureArgs
}

if (!(Test-Path -LiteralPath $EnvPath)) {
    throw ".env non trovato. Eseguire configure_sqlserver_env.ps1 oppure creare .env da .env.test-sqlserver.example."
}

if (!(Test-Path -LiteralPath $RequirementsPath)) {
    throw "requirements.txt non trovato nel repository root."
}

Write-Step "Verifica prerequisiti"
$pythonCommand = Assert-CommandExists -Name "python" -InstallHint "Installare una versione Python supportata e renderla disponibile nel PATH."

Invoke-CheckedCommand -FilePath $pythonCommand.Source -Arguments @("--version")

if (!$SkipFrontendBuild) {
    $nodeCommand = Assert-CommandExists -Name "node" -InstallHint "Installare Node.js LTS."
    $npmCommand = Assert-CommandExists -Name "npm" -InstallHint "Installare Node.js LTS con npm."

    Invoke-CheckedCommand -FilePath $nodeCommand.Source -Arguments @("--version")
    Invoke-CheckedCommand -FilePath $npmCommand.Source -Arguments @("--version")
}

if (!(Test-OdbcDriver18)) {
    throw "ODBC Driver 18 for SQL Server non trovato. Installarlo sul PC di test prima di continuare."
}
Write-Host "ODBC Driver 18 for SQL Server: trovato"

Write-Step "Ambiente Python"
if (!(Test-Path -LiteralPath $VenvPython)) {
    Write-Host "Creo .venv locale..."
    Invoke-CheckedCommand -FilePath $pythonCommand.Source -Arguments @("-m", "venv", ".venv")
} else {
    Write-Host ".venv esistente trovato."
}

Invoke-CheckedCommand -FilePath $VenvPython -Arguments @("-m", "pip", "install", "--upgrade", "pip")
Invoke-CheckedCommand -FilePath $VenvPython -Arguments @("-m", "pip", "install", "-r", "requirements.txt")

if ($SkipFrontendBuild) {
    Write-Step "Build frontend saltata"
    if (!(Test-Path -LiteralPath (Join-Path $FrontendDir "dist\index.html"))) {
        throw "frontend/dist/index.html non trovato. Il pacchetto installer deve includere il frontend gia compilato oppure rieseguire senza -SkipFrontendBuild su una macchina con Node/npm."
    }
    Write-Host "Uso frontend/dist gia incluso nel pacchetto installer."
    Write-Host "Modalita installer: non richiedere Node/npm sul PC di test."
} else {
    Write-Step "Frontend React"
    if (!(Test-Path -LiteralPath $FrontendDir)) {
        throw "Cartella frontend non trovata."
    }

    if (!(Test-Path -LiteralPath $FrontendNodeModules)) {
        if (Test-Path -LiteralPath $FrontendPackageLock) {
            Invoke-CheckedCommand -FilePath $npmCommand.Source -Arguments @("--prefix", "frontend", "ci")
        } else {
            Invoke-CheckedCommand -FilePath $npmCommand.Source -Arguments @("--prefix", "frontend", "install")
        }
    } else {
        Write-Host "Dipendenze frontend gia presenti."
    }

    Invoke-CheckedCommand -FilePath $npmCommand.Source -Arguments @("--prefix", "frontend", "run", "build")
}

Write-Step "Database SQL Server TEST"
Invoke-CheckedCommand -FilePath $VenvPython -Arguments @("manage.py", "security_db_check")
Invoke-CheckedCommand -FilePath $VenvPython -Arguments @("manage.py", "migrate")

if ($SeedDemo) {
    Write-Step "Dati demo sintetici"
    Invoke-CheckedCommand -FilePath $VenvPython -Arguments @("manage.py", "seed_security_uat_demo", "--reset")
    Invoke-CheckedCommand -FilePath $VenvPython -Arguments @("manage.py", "seed_security_uat_demo")

    if ($SkipSmokeCheck) {
        Write-Host "Smoke check saltato per richiesta operatore."
    } else {
        Invoke-CheckedCommand -FilePath $VenvPython -Arguments @("manage.py", "security_uat_smoke_check")
    }
} elseif (!$SkipSmokeCheck) {
    Write-Host ""
    Write-Host "Smoke check non eseguito perche -SeedDemo non e stato specificato."
    Write-Host "Per validare il pacchetto demo: rieseguire lo script con -SeedDemo oppure eseguire python manage.py security_uat_smoke_check dopo il seed."
}

if ($InstallService) {
    Write-Step "Installazione servizio Windows"
    if (!(Test-Path -LiteralPath $InstallServiceScript)) {
        throw "Script install_service.ps1 non trovato: $InstallServiceScript"
    }

    $serviceWrapper = Resolve-ServiceWrapperForServiceInstall
    Write-Host ("Wrapper servizio trovato: {0} ({1})" -f $serviceWrapper.Type, $serviceWrapper.Path)

    Invoke-CheckedCommand -FilePath "powershell" -Arguments @(
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        $InstallServiceScript,
        "-StartService"
    )
}

Write-Step "Setup completato"
Write-Host "Prossimi passi:"
if ($InstallService) {
    Write-Host "  .\scripts\windows\service_status.bat"
    Write-Host "  .\scripts\windows\open_security_center.bat"
} else {
    Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\windows\install_service.ps1 -StartService"
    Write-Host "  .\scripts\windows\open_security_center.bat"
    Write-Host "  Oppure, in modalita manuale legacy: .\scripts\windows\start_security_center.bat"
}
Write-Host ""
Write-Host "Da un altro PC in LAN aprire: http://<PC-IP>:8000/"
Write-Host "Non esporre questo deployment TEST su Internet."
