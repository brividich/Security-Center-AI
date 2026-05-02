[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "High")]
param(
    [switch]$ForceUnsafeName,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$EnvPath = Join-Path $RepoRoot ".env"

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

function Test-Truthy {
    param([string]$Value, [bool]$Default = $false)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $Default
    }

    return $Value.Trim().ToLowerInvariant() -in @("true", "1", "yes", "y", "s", "si", "on")
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

function Invoke-NonQuery {
    param(
        [Parameter(Mandatory = $true)][System.Data.Odbc.OdbcConnection]$Connection,
        [Parameter(Mandatory = $true)][string]$Sql
    )

    $command = $Connection.CreateCommand()
    try {
        $command.CommandText = $Sql
        $null = $command.ExecuteNonQuery()
    } finally {
        $command.Dispose()
    }
}

Set-Location $RepoRoot

Write-Host "Security Center AI - rimozione database SQL Server TEST"
Write-Host "Questo script non viene mai eseguito dall'uninstaller."

if (!(Test-Path -LiteralPath $EnvPath)) {
    throw ".env non trovato. Configurare prima SQL Server oppure indicare manualmente il database da rimuovere con uno strumento SQL."
}

$values = Read-EnvFile -Path $EnvPath
$dbName = Get-SettingValue -Values $values -Key "DB_NAME" -DefaultValue ""
$server = Get-SettingValue -Values $values -Key "DB_HOST" -DefaultValue "localhost\SQLEXPRESS"
$driver = Get-SettingValue -Values $values -Key "DB_DRIVER" -DefaultValue "ODBC Driver 18 for SQL Server"
$trusted = Test-Truthy -Value (Get-SettingValue -Values $values -Key "DB_TRUSTED_CONNECTION" -DefaultValue "True") -Default $true
$trustCertificate = Test-Truthy -Value (Get-SettingValue -Values $values -Key "DB_TRUST_SERVER_CERTIFICATE" -DefaultValue "True") -Default $true
$user = Get-SettingValue -Values $values -Key "DB_USER" -DefaultValue ""
$password = Get-SettingValue -Values $values -Key "DB_PASSWORD" -DefaultValue ""

if ([string]::IsNullOrWhiteSpace($dbName)) {
    throw "DB_NAME vuoto nella .env. Interrompo."
}

if ($dbName -notmatch "(?i)(TEST|UAT)" -and !$ForceUnsafeName) {
    throw "Il nome database non contiene TEST o UAT. Interrompo per evitare perdita dati. Usare -ForceUnsafeName solo dopo revisione esplicita."
}

$quotedName = Quote-SqlIdentifier -Name $dbName
$dropSql = "ALTER DATABASE $quotedName SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE $quotedName;"

Write-Host "Server SQL: $server"
Write-Host "Database da eliminare: $dbName"
Write-Host "Azione irreversibile riservata a database di test."

if ($DryRun) {
    Write-Host "Dry run: nessuna eliminazione eseguita."
    Write-Host $dropSql
    return
}

$expectedConfirmation = "DROP $dbName"
$confirmation = Read-Host "Digitare esattamente '$expectedConfirmation' per confermare"
if ($confirmation -cne $expectedConfirmation) {
    Write-Host "Conferma non corrispondente. Operazione annullata."
    return
}

if (!$PSCmdlet.ShouldProcess($dbName, "Drop SQL Server test database")) {
    return
}

$connectionString = New-SqlConnectionString -Server $server -Database "master" -Driver $driver -Trusted:$trusted -User $user -Password $password -TrustCertificate:$trustCertificate
$connection = New-Object -TypeName System.Data.Odbc.OdbcConnection -ArgumentList $connectionString
try {
    $connection.Open()
    Invoke-NonQuery -Connection $connection -Sql $dropSql
} finally {
    $connection.Dispose()
}

Write-Host "Database eliminato: $dbName"
