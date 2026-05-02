[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$RuleName = "Security Center AI 8000"

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-Host "Security Center AI - apertura firewall TCP 8000"

if (!(Test-IsAdministrator)) {
    throw "Lo script richiede PowerShell avviata come Amministratore."
}

$existingRule = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
if ($existingRule) {
    Write-Host "Regola firewall gia presente: $RuleName"
    exit 0
}

New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow | Out-Null
Write-Host "Regola firewall creata: $RuleName"
