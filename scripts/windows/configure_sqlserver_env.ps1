[CmdletBinding()]
param(
    [string]$DbHost = "",
    [string]$DbName = "",
    [string]$TrustedConnection = "",
    [string]$DbUser = "",
    [string]$DbPassword = "",
    [string]$DbDriver = "",
    [string]$TrustServerCertificate = "",
    [string]$AllowedHosts = "",
    [string]$Port = "",
    [string]$DebugMode = "",
    [switch]$Force,
    [switch]$TestConnection,
    [switch]$CreateDatabase,
    [switch]$RunMigrations,
    [switch]$SeedDemo,
    [switch]$NonInteractive,
    [switch]$SkipDjangoActions
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$EnvPath = Join-Path $RepoRoot ".env"
$EnvExamplePath = Join-Path $RepoRoot ".env.test-sqlserver.example"
$VenvPython = Join-Path $RepoRoot ".venv\Scripts\python.exe"

$ManagedKeys = @(
    "DEBUG",
    "SECRET_KEY",
    "ALLOWED_HOSTS",
    "DB_ENGINE",
    "DB_NAME",
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_PASSWORD",
    "DB_TRUSTED_CONNECTION",
    "DB_DRIVER",
    "DB_TRUST_SERVER_CERTIFICATE",
    "SERVE_REACT_APP",
    "SECURITY_CENTER_HOST",
    "SECURITY_CENTER_PORT"
)

$SecretKeys = @("SECRET_KEY", "DB_PASSWORD")

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host ""
    Write-Host "== $Message =="
}

function Test-Truthy {
    param([string]$Value, [bool]$Default = $false)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $Default
    }

    return $Value.Trim().ToLowerInvariant() -in @("true", "1", "yes", "y", "s", "si", "on")
}

function Convert-BoolText {
    param([bool]$Value)

    if ($Value) {
        return "True"
    }

    return "False"
}

function Read-TextValue {
    param(
        [Parameter(Mandatory = $true)][string]$Prompt,
        [AllowEmptyString()][string]$DefaultValue
    )

    $suffix = ""
    if (![string]::IsNullOrWhiteSpace($DefaultValue)) {
        $suffix = " [$DefaultValue]"
    }

    $value = Read-Host "$Prompt$suffix"
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $DefaultValue
    }

    return $value.Trim()
}

function Read-YesNo {
    param(
        [Parameter(Mandatory = $true)][string]$Prompt,
        [bool]$Default = $false
    )

    $defaultLabel = "N"
    if ($Default) {
        $defaultLabel = "s"
    }

    $answer = Read-Host "$Prompt [s/N default: $defaultLabel]"
    return Test-Truthy -Value $answer -Default $Default
}

function Read-SecureText {
    param(
        [Parameter(Mandatory = $true)][string]$Prompt,
        [bool]$AllowEmpty = $false
    )

    while ($true) {
        $secureValue = Read-Host $Prompt -AsSecureString
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
        try {
            $plainValue = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        } finally {
            if ($bstr -ne [IntPtr]::Zero) {
                [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
            }
        }

        if ($AllowEmpty -or ![string]::IsNullOrWhiteSpace($plainValue)) {
            return $plainValue
        }

        Write-Host "Password richiesta per autenticazione SQL."
    }
}

function New-DjangoSecretKey {
    $bytes = New-Object byte[] 48
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    } finally {
        $rng.Dispose()
    }

    $hex = -join ($bytes | ForEach-Object { $_.ToString("x2") })
    return "test-" + $hex
}

function Normalize-EnvValue {
    param([AllowEmptyString()][string]$Value)

    if ($null -eq $Value) {
        return ""
    }

    $trimmed = $Value.Trim()
    if ($trimmed.Length -ge 2) {
        if (($trimmed.StartsWith('"') -and $trimmed.EndsWith('"')) -or ($trimmed.StartsWith("'") -and $trimmed.EndsWith("'"))) {
            return $trimmed.Substring(1, $trimmed.Length - 2)
        }
    }

    return $trimmed
}

function Read-EnvFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    $result = [ordered]@{}
    if (!(Test-Path -LiteralPath $Path)) {
        return $result
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$") {
            $key = $Matches[1]
            if (!$result.Contains($key)) {
                $result[$key] = Normalize-EnvValue -Value $Matches[2]
            }
        }
    }

    return $result
}

function Format-EnvLine {
    param(
        [Parameter(Mandatory = $true)][string]$Key,
        [AllowEmptyString()][string]$Value
    )

    return "$Key=$Value"
}

function Update-EnvFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][hashtable]$Updates
    )

    $lines = @()
    if (Test-Path -LiteralPath $Path) {
        $lines = @(Get-Content -LiteralPath $Path)
    }

    $seen = @{}
    $output = New-Object System.Collections.Generic.List[string]

    foreach ($line in $lines) {
        if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=") {
            $key = $Matches[1]
            if ($Updates.ContainsKey($key)) {
                if (!$seen.ContainsKey($key)) {
                    $output.Add((Format-EnvLine -Key $key -Value $Updates[$key]))
                    $seen[$key] = $true
                }
                continue
            }
        }

        $output.Add($line)
    }

    foreach ($key in $ManagedKeys) {
        if ($Updates.ContainsKey($key) -and !$seen.ContainsKey($key)) {
            $output.Add((Format-EnvLine -Key $key -Value $Updates[$key]))
            $seen[$key] = $true
        }
    }

    Set-Content -LiteralPath $Path -Value $output -Encoding UTF8
}

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

function Resolve-PythonCommand {
    if (Test-Path -LiteralPath $VenvPython) {
        return (Resolve-Path -LiteralPath $VenvPython).Path
    }

    $pythonCommand = Get-Command "python" -ErrorAction SilentlyContinue
    if ($pythonCommand) {
        return $pythonCommand.Source
    }

    throw "Python non trovato. Installare Python oppure eseguire setup_test_deployment.ps1 prima dei controlli Django."
}

function Write-ConfigurationSummary {
    param([Parameter(Mandatory = $true)][hashtable]$Values)

    Write-Host "Configurazione salvata in .env:"
    foreach ($key in @("DB_ENGINE", "DB_HOST", "DB_NAME", "DB_USER", "DB_TRUSTED_CONNECTION", "DB_DRIVER", "DB_TRUST_SERVER_CERTIFICATE", "ALLOWED_HOSTS", "SECURITY_CENTER_PORT", "DEBUG", "SERVE_REACT_APP")) {
        if ($Values.ContainsKey($key)) {
            $value = $Values[$key]
            if ($SecretKeys -contains $key) {
                $value = "<masked>"
            }
            Write-Host ("  {0}={1}" -f $key, $value)
        }
    }

    if ($Values.ContainsKey("DB_PASSWORD")) {
        Write-Host "  Password SQL: <masked>"
    }

    if ($Values.ContainsKey("SECRET_KEY")) {
        Write-Host "  Django secret key: <masked>"
    }
}

function Get-SettingValue {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Values,
        [Parameter(Mandatory = $true)][string]$Key,
        [AllowEmptyString()][string]$DefaultValue = ""
    )

    if ($Values.ContainsKey($Key) -and ![string]::IsNullOrWhiteSpace($Values[$Key])) {
        return $Values[$Key]
    }

    return $DefaultValue
}

function Quote-SqlIdentifier {
    param([Parameter(Mandatory = $true)][string]$Name)

    return "[" + $Name.Replace("]", "]]") + "]"
}

function Write-ManualDatabaseScript {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [bool]$ShowLoginPlaceholder = $false
    )

    $quotedName = Quote-SqlIdentifier -Name $Name
    Write-Host ""
    Write-Host "Script SQL manuale:"
    Write-Host "CREATE DATABASE $quotedName;"

    if ($ShowLoginPlaceholder) {
        Write-Host ""
        Write-Host "Placeholder opzionale per login SQL di test:"
        Write-Host "CREATE LOGIN security_center_test WITH PASSWORD = '<CHANGE_ME_STRONG_PASSWORD>';"
        Write-Host "USE $quotedName;"
        Write-Host "CREATE USER security_center_test FOR LOGIN security_center_test;"
        Write-Host "ALTER ROLE db_owner ADD MEMBER security_center_test;"
    }
}

function New-SqlConnectionString {
    param(
        [Parameter(Mandatory = $true)][string]$Server,
        [Parameter(Mandatory = $true)][string]$Database,
        [Parameter(Mandatory = $true)][string]$Driver,
        [bool]$Trusted,
        [AllowEmptyString()][string]$User = "",
        [AllowEmptyString()][string]$Password = "",
        [bool]$TrustCertificate = $true
    )

    $builder = New-Object -TypeName System.Data.Odbc.OdbcConnectionStringBuilder
    $builder["Driver"] = $Driver
    $builder["Server"] = $Server
    $builder["Database"] = $Database
    $builder["Encrypt"] = "Yes"
    if ($TrustCertificate) {
        $builder["TrustServerCertificate"] = "Yes"
    } else {
        $builder["TrustServerCertificate"] = "No"
    }

    if ($Trusted) {
        $builder["Trusted_Connection"] = "Yes"
    } else {
        $builder["UID"] = $User
        $builder["PWD"] = $Password
    }

    return $builder.ConnectionString
}

function Open-SqlConnection {
    param([Parameter(Mandatory = $true)][string]$ConnectionString)

    $connection = New-Object -TypeName System.Data.Odbc.OdbcConnection -ArgumentList $ConnectionString
    try {
        $connection.Open()
        return $connection
    } catch {
        $connection.Dispose()
        throw
    }
}

function Test-IsLocalSqlServerName {
    param([AllowEmptyString()][string]$Server)

    if ([string]::IsNullOrWhiteSpace($Server)) {
        return $true
    }

    $serverPart = ($Server -split "\\", 2)[0]
    $serverPart = ($serverPart -split ",", 2)[0].Trim()
    return $serverPart -in @(".", "(local)", "localhost", "127.0.0.1", "::1", $env:COMPUTERNAME)
}

function Add-UniqueSqlCandidate {
    param(
        [AllowEmptyCollection()][System.Collections.Generic.List[string]]$Candidates,
        [AllowEmptyString()][string]$Value
    )

    if ($null -eq $Candidates -or [string]::IsNullOrWhiteSpace($Value)) {
        return
    }

    $normalized = $Value.Trim()
    foreach ($existing in $Candidates) {
        if ($existing -ieq $normalized) {
            return
        }
    }

    $Candidates.Add($normalized)
}

function Get-LocalSqlInstanceCandidates {
    param([AllowEmptyString()][string]$PreferredServer)

    $candidates = New-Object System.Collections.Generic.List[string]
    Add-UniqueSqlCandidate -Candidates $candidates -Value $PreferredServer

    Write-Host "Discovery istanze SQL Server locali..."

    try {
        $services = @(Get-Service -ErrorAction SilentlyContinue | Where-Object {
            $_.Name -eq "MSSQLSERVER" -or $_.Name -like "MSSQL$*"
        })

        foreach ($service in $services) {
            if ($service.Name -eq "MSSQLSERVER") {
                Write-Host "Istanza SQL rilevata da servizio: localhost ($($service.Status))"
                Add-UniqueSqlCandidate -Candidates $candidates -Value "localhost"
                Add-UniqueSqlCandidate -Candidates $candidates -Value "$env:COMPUTERNAME"
            } elseif ($service.Name -like "MSSQL$*") {
                $instanceName = $service.Name.Substring(6)
                Write-Host "Istanza SQL rilevata da servizio: localhost\$instanceName ($($service.Status))"
                Add-UniqueSqlCandidate -Candidates $candidates -Value "localhost\$instanceName"
                Add-UniqueSqlCandidate -Candidates $candidates -Value "$env:COMPUTERNAME\$instanceName"
            }
        }
    } catch {
        Write-Host "Discovery servizi SQL Server non disponibile: $($_.Exception.Message)"
    }

    $registryPaths = @(
        "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Microsoft SQL Server\Instance Names\SQL"
    )

    foreach ($registryPath in $registryPaths) {
        try {
            if (Test-Path -LiteralPath $registryPath) {
                $instanceProperties = Get-ItemProperty -LiteralPath $registryPath
                foreach ($property in $instanceProperties.PSObject.Properties) {
                    if ($property.Name -in @("PSPath", "PSParentPath", "PSChildName", "PSDrive", "PSProvider")) {
                        continue
                    }

                    if ($property.Name -eq "MSSQLSERVER") {
                        Write-Host "Istanza SQL rilevata da registry: localhost"
                        Add-UniqueSqlCandidate -Candidates $candidates -Value "localhost"
                        Add-UniqueSqlCandidate -Candidates $candidates -Value "$env:COMPUTERNAME"
                    } else {
                        Write-Host "Istanza SQL rilevata da registry: localhost\$($property.Name)"
                        Add-UniqueSqlCandidate -Candidates $candidates -Value "localhost\$($property.Name)"
                        Add-UniqueSqlCandidate -Candidates $candidates -Value "$env:COMPUTERNAME\$($property.Name)"
                    }
                }
            }
        } catch {
            Write-Host "Discovery registry SQL Server non disponibile: $($_.Exception.Message)"
        }
    }

    Add-UniqueSqlCandidate -Candidates $candidates -Value "localhost\SQLEXPRESS"
    Add-UniqueSqlCandidate -Candidates $candidates -Value ".\SQLEXPRESS"
    Add-UniqueSqlCandidate -Candidates $candidates -Value "localhost"

    return $candidates.ToArray()
}

function Open-SqlConnectionWithDiscovery {
    param(
        [Parameter(Mandatory = $true)][string]$Server,
        [Parameter(Mandatory = $true)][string]$Database,
        [Parameter(Mandatory = $true)][string]$Driver,
        [bool]$Trusted,
        [AllowEmptyString()][string]$User = "",
        [AllowEmptyString()][string]$Password = "",
        [bool]$TrustCertificate = $true
    )

    $connectionString = New-SqlConnectionString -Server $Server -Database $Database -Driver $Driver -Trusted:$Trusted -User $User -Password $Password -TrustCertificate:$TrustCertificate
    try {
        $connection = Open-SqlConnection -ConnectionString $connectionString
        return @{ Connection = $connection; Server = $Server }
    } catch {
        $firstError = $_
        Write-Host "Connessione a '$Server' non riuscita: $($_.Exception.Message)"

        if (!(Test-IsLocalSqlServerName -Server $Server)) {
            throw
        }

        $candidates = @(Get-LocalSqlInstanceCandidates -PreferredServer $Server)
        foreach ($candidate in $candidates) {
            if ([string]::IsNullOrWhiteSpace($candidate) -or $candidate -ieq $Server) {
                continue
            }

            Write-Host "Provo istanza SQL rilevata: $candidate"
            $candidateConnectionString = New-SqlConnectionString -Server $candidate -Database $Database -Driver $Driver -Trusted:$Trusted -User $User -Password $Password -TrustCertificate:$TrustCertificate
            try {
                $connection = Open-SqlConnection -ConnectionString $candidateConnectionString
                Write-Host "Connessione riuscita con istanza SQL rilevata: $candidate"
                return @{ Connection = $connection; Server = $candidate }
            } catch {
                Write-Host "Istanza non raggiungibile: $candidate"
            }
        }

        throw $firstError
    }
}

function Test-DatabaseExists {
    param(
        [Parameter(Mandatory = $true)][System.Data.Odbc.OdbcConnection]$Connection,
        [Parameter(Mandatory = $true)][string]$Name
    )

    $command = $Connection.CreateCommand()
    try {
        $command.CommandText = "SELECT DB_ID(?)"
        $null = $command.Parameters.Add("@db_name", [System.Data.Odbc.OdbcType]::NVarChar, 128)
        $command.Parameters[0].Value = $Name
        $result = $command.ExecuteScalar()
        return ($null -ne $result -and $result -ne [System.DBNull]::Value)
    } finally {
        $command.Dispose()
    }
}

function New-ConfiguredDatabase {
    param(
        [Parameter(Mandatory = $true)][System.Data.Odbc.OdbcConnection]$Connection,
        [Parameter(Mandatory = $true)][string]$Name
    )

    $command = $Connection.CreateCommand()
    try {
        $command.CommandText = "CREATE DATABASE $(Quote-SqlIdentifier -Name $Name)"
        $null = $command.ExecuteNonQuery()
    } finally {
        $command.Dispose()
    }
}

function Ensure-ConfiguredDatabase {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Values,
        [bool]$AllowInteractiveCreate,
        [bool]$CreateWhenMissing
    )

    $server = Get-SettingValue -Values $Values -Key "DB_HOST" -DefaultValue "localhost\SQLEXPRESS"
    $name = Get-SettingValue -Values $Values -Key "DB_NAME" -DefaultValue "SecurityCenterAI_TEST"
    $driver = Get-SettingValue -Values $Values -Key "DB_DRIVER" -DefaultValue "ODBC Driver 18 for SQL Server"
    $trusted = Test-Truthy -Value (Get-SettingValue -Values $Values -Key "DB_TRUSTED_CONNECTION" -DefaultValue "True") -Default $true
    $trustCertificate = Test-Truthy -Value (Get-SettingValue -Values $Values -Key "DB_TRUST_SERVER_CERTIFICATE" -DefaultValue "True") -Default $true
    $user = Get-SettingValue -Values $Values -Key "DB_USER" -DefaultValue ""
    $password = Get-SettingValue -Values $Values -Key "DB_PASSWORD" -DefaultValue ""

    Write-Step "Verifica database SQL Server"
    Write-Host "Server SQL: $server"
    Write-Host "Database configurato: $name"
    Write-Host "Verifico prima la connessione all'istanza SQL Server..."

    $connection = $null
    try {
        $connectionResult = Open-SqlConnectionWithDiscovery -Server $server -Database "master" -Driver $driver -Trusted:$trusted -User $user -Password $password -TrustCertificate:$trustCertificate
        $connection = $connectionResult.Connection
        if ($connectionResult.Server -ne $server) {
            $server = $connectionResult.Server
            $Values["DB_HOST"] = $server
            Update-EnvFile -Path $EnvPath -Updates @{ "DB_HOST" = $server }
            Write-Host "DB_HOST aggiornato nella .env con istanza rilevata: $server"
        }

        Write-Host "Connessione all'istanza SQL Server riuscita."

        if (Test-DatabaseExists -Connection $connection -Name $name) {
            Write-Host "Database trovato: $name"
            return $true
        }

        Write-Host ""
        Write-Host "Il database configurato non esiste: $name"
        Write-Host "La creazione non viene mai eseguita in modo silenzioso."

        $shouldCreate = $CreateWhenMissing
        if (!$shouldCreate -and $AllowInteractiveCreate) {
            $shouldCreate = Read-YesNo -Prompt "Tentare la creazione del database ora?" -Default $false
        }

        if (!$shouldCreate) {
            Write-Host "Creazione database non richiesta. Eseguire lo script SQL manuale e poi rilanciare il setup."
            Write-ManualDatabaseScript -Name $name -ShowLoginPlaceholder:(!$trusted)
            return $false
        }

        Write-Host "Creazione esplicita richiesta. Tento CREATE DATABASE..."
        try {
            New-ConfiguredDatabase -Connection $connection -Name $name
        } catch {
            Write-Host "Creazione database non riuscita. Usare uno strumento SQL Server con un account autorizzato."
            Write-ManualDatabaseScript -Name $name -ShowLoginPlaceholder:(!$trusted)
            throw "CREATE DATABASE non riuscito per il database configurato."
        }

        Write-Host "Database creato: $name"
        return $true
    } catch {
        Write-Host "Connessione o verifica SQL Server non riuscita. Controllare host, driver ODBC, autenticazione e permessi."
        throw
    } finally {
        if ($connection) {
            $connection.Dispose()
        }
    }
}

Set-Location $RepoRoot

Write-Host "Security Center AI - configurazione SQL Server TEST"
Write-Host "Uso previsto: PC di test in LAN. Non usare database di produzione e non esporre su Internet."

$envWasMissing = !(Test-Path -LiteralPath $EnvPath)
if ($envWasMissing) {
    if (!(Test-Path -LiteralPath $EnvExamplePath)) {
        throw ".env mancante e .env.test-sqlserver.example non trovato. Creare una .env sanitizzata prima di continuare."
    }

    Copy-Item -LiteralPath $EnvExamplePath -Destination $EnvPath
    Write-Host ".env creato da .env.test-sqlserver.example."
}

$currentValues = Read-EnvFile -Path $EnvPath
$confirmedUpdate = $false
$skipPrompts = [bool]($Force -or $NonInteractive)

if (!$envWasMissing -and !$Force) {
    if ($NonInteractive) {
        Write-Host ".env esistente trovato. Modalita non interattiva senza -Force: mantengo il supporto manuale della .env esistente."
    } else {
        Write-Host ""
        Write-Host ".env esistente trovato. Le chiavi SQL Server e deployment gestite possono essere aggiornate."
        $answer = Read-Host "Aggiornare la configurazione guidata in .env? [s/N]"
        if (!(Test-Truthy -Value $answer -Default $false)) {
            Write-Host "Configurazione non modificata. Mantengo il supporto manuale della .env esistente."
        } else {
            $confirmedUpdate = $true
        }
    }
}

$shouldUpdateEnv = $envWasMissing -or $Force -or $confirmedUpdate
$updates = @{}

if ($shouldUpdateEnv) {
    Write-Step "Parametri SQL Server"

    if ([string]::IsNullOrWhiteSpace($DbHost)) {
        $hostDefault = Get-SettingValue -Values $currentValues -Key "DB_HOST" -DefaultValue "localhost\SQLEXPRESS"
        if ($skipPrompts) {
            $DbHost = $hostDefault
        } else {
            $DbHost = Read-TextValue -Prompt "Server SQL" -DefaultValue $hostDefault
        }
    }

    if ([string]::IsNullOrWhiteSpace($DbName)) {
        $nameDefault = Get-SettingValue -Values $currentValues -Key "DB_NAME" -DefaultValue "SecurityCenterAI_TEST"
        if ($skipPrompts) {
            $DbName = $nameDefault
        } else {
            $DbName = Read-TextValue -Prompt "Database SQL" -DefaultValue $nameDefault
        }
    }

    if ([string]::IsNullOrWhiteSpace($TrustedConnection)) {
        $trustedDefault = Get-SettingValue -Values $currentValues -Key "DB_TRUSTED_CONNECTION" -DefaultValue "True"
        if ($skipPrompts) {
            $TrustedConnection = $trustedDefault
        } else {
            $TrustedConnection = Read-TextValue -Prompt "Autenticazione Windows / Trusted Connection (True/False)" -DefaultValue $trustedDefault
        }
    }

    $trusted = Test-Truthy -Value $TrustedConnection -Default $true
    if (!$trusted) {
        if ([string]::IsNullOrWhiteSpace($DbUser)) {
            $userDefault = Get-SettingValue -Values $currentValues -Key "DB_USER" -DefaultValue ""
            if ($skipPrompts) {
                $DbUser = $userDefault
            } else {
                $DbUser = Read-TextValue -Prompt "Utente SQL" -DefaultValue $userDefault
            }
        }

        if (!$PSBoundParameters.ContainsKey("DbPassword")) {
            $hasExistingPassword = $currentValues.Contains("DB_PASSWORD") -and ![string]::IsNullOrWhiteSpace($currentValues["DB_PASSWORD"])
            if ($skipPrompts -and $hasExistingPassword) {
                $DbPassword = $currentValues["DB_PASSWORD"]
            } elseif ($skipPrompts) {
                throw "Password SQL mancante. Fornire -DbPassword oppure usare Trusted Connection."
            } else {
                $prompt = "Password SQL"
                if ($hasExistingPassword) {
                    $prompt = "Password SQL (INVIO per mantenere quella esistente)"
                }

                $enteredPassword = Read-SecureText -Prompt $prompt -AllowEmpty:$hasExistingPassword
                if ([string]::IsNullOrWhiteSpace($enteredPassword) -and $hasExistingPassword) {
                    $DbPassword = $currentValues["DB_PASSWORD"]
                } else {
                    $DbPassword = $enteredPassword
                }
            }
        }
    } else {
        $DbUser = ""
        $DbPassword = ""
    }

    if ([string]::IsNullOrWhiteSpace($DbDriver)) {
        $driverDefault = Get-SettingValue -Values $currentValues -Key "DB_DRIVER" -DefaultValue "ODBC Driver 18 for SQL Server"
        if ($skipPrompts) {
            $DbDriver = $driverDefault
        } else {
            $DbDriver = Read-TextValue -Prompt "Driver ODBC SQL Server" -DefaultValue $driverDefault
        }
    }

    if ([string]::IsNullOrWhiteSpace($TrustServerCertificate)) {
        $trustServerCertificateDefault = Get-SettingValue -Values $currentValues -Key "DB_TRUST_SERVER_CERTIFICATE" -DefaultValue "True"
        if ($skipPrompts) {
            $TrustServerCertificate = $trustServerCertificateDefault
        } else {
            $TrustServerCertificate = Read-TextValue -Prompt "Trust Server Certificate (True/False)" -DefaultValue $trustServerCertificateDefault
        }
    }

    if ([string]::IsNullOrWhiteSpace($AllowedHosts)) {
        $allowedDefault = Get-SettingValue -Values $currentValues -Key "ALLOWED_HOSTS" -DefaultValue "127.0.0.1,localhost"
        if ($skipPrompts) {
            $AllowedHosts = $allowedDefault
        } else {
            $AllowedHosts = Read-TextValue -Prompt "Host Django consentiti" -DefaultValue $allowedDefault
        }
    }

    if ([string]::IsNullOrWhiteSpace($Port)) {
        $portDefault = Get-SettingValue -Values $currentValues -Key "SECURITY_CENTER_PORT" -DefaultValue "8000"
        if ($skipPrompts) {
            $Port = $portDefault
        } else {
            $Port = Read-TextValue -Prompt "Porta applicazione" -DefaultValue $portDefault
        }
    }

    if ([string]::IsNullOrWhiteSpace($DebugMode)) {
        $debugDefault = Get-SettingValue -Values $currentValues -Key "DEBUG" -DefaultValue "True"
        if ($skipPrompts) {
            $DebugMode = $debugDefault
        } else {
            $DebugMode = Read-TextValue -Prompt "DEBUG test (True/False)" -DefaultValue $debugDefault
        }
    }

    $updates["DEBUG"] = Convert-BoolText -Value (Test-Truthy -Value $DebugMode -Default $true)
    if (!$currentValues.Contains("SECRET_KEY") -or [string]::IsNullOrWhiteSpace($currentValues["SECRET_KEY"])) {
        $updates["SECRET_KEY"] = New-DjangoSecretKey
    }
    $updates["ALLOWED_HOSTS"] = $AllowedHosts
    $updates["DB_ENGINE"] = "mssql"
    $updates["DB_NAME"] = $DbName
    $updates["DB_HOST"] = $DbHost
    $updates["DB_PORT"] = ""
    $updates["DB_USER"] = $DbUser
    $updates["DB_PASSWORD"] = $DbPassword
    $updates["DB_TRUSTED_CONNECTION"] = Convert-BoolText -Value $trusted
    $updates["DB_DRIVER"] = $DbDriver
    $updates["DB_TRUST_SERVER_CERTIFICATE"] = Convert-BoolText -Value (Test-Truthy -Value $TrustServerCertificate -Default $true)
    $updates["SERVE_REACT_APP"] = "True"
    $updates["SECURITY_CENTER_HOST"] = "0.0.0.0"
    $updates["SECURITY_CENTER_PORT"] = $Port

    Update-EnvFile -Path $EnvPath -Updates $updates
    Write-ConfigurationSummary -Values $updates
    $currentValues = Read-EnvFile -Path $EnvPath
}

if (!$NonInteractive -and !$SkipDjangoActions) {
    if (!$TestConnection) {
        $TestConnection = Read-YesNo -Prompt "Testare la connessione Django al database dopo la verifica SQL Server?" -Default $true
    }
    if (!$RunMigrations) {
        $RunMigrations = Read-YesNo -Prompt "Eseguire le migrazioni Django se il database esiste?" -Default $false
    }
    if (!$SeedDemo) {
        $SeedDemo = Read-YesNo -Prompt "Caricare dati demo sintetici dopo le migrazioni?" -Default $false
    }
}

$databaseReady = Ensure-ConfiguredDatabase -Values $currentValues -AllowInteractiveCreate:(!$NonInteractive) -CreateWhenMissing:$CreateDatabase

if (!$databaseReady) {
    throw "Database non disponibile. Operazione interrotta prima di test Django, migrazioni o seed."
}

if ($TestConnection) {
    Write-Step "Test connessione database"
    $python = Resolve-PythonCommand
    Invoke-CheckedCommand -FilePath $python -Arguments @("manage.py", "security_db_check")
}

if ($RunMigrations) {
    Write-Step "Migrazioni database"
    $python = Resolve-PythonCommand
    Invoke-CheckedCommand -FilePath $python -Arguments @("manage.py", "migrate")
}

if ($SeedDemo) {
    Write-Step "Dati demo sintetici e smoke check"
    $python = Resolve-PythonCommand
    Invoke-CheckedCommand -FilePath $python -Arguments @("manage.py", "seed_security_uat_demo", "--reset")
    Invoke-CheckedCommand -FilePath $python -Arguments @("manage.py", "seed_security_uat_demo")
    Invoke-CheckedCommand -FilePath $python -Arguments @("manage.py", "security_uat_smoke_check")
}

Write-Host ""
Write-Host "Configurazione SQL Server completata. La .env locale contiene valori sensibili se e stata usata autenticazione SQL."
