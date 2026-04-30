param(
    [Parameter(Mandatory = $true)]
    [int]$Port
)

$allowedNames = @("python", "py", "node", "npm", "cmd", "powershell", "pwsh")
$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

if (-not $listeners) {
    Write-Host "Port ${Port}: no active listener found."
    exit 0
}

foreach ($listener in $listeners) {
    $process = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
    $name = if ($process) { $process.ProcessName } else { "unknown" }

    Write-Host "Port ${Port}: PID $($listener.OwningProcess) ($name) is listening."

    if ($process -and ($allowedNames -contains $process.ProcessName.ToLowerInvariant())) {
        Write-Host "Port ${Port}: stopping likely dev process PID $($process.Id) ($($process.ProcessName))."
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
    else {
        Write-Warning "Port ${Port}: not stopping unknown process PID $($listener.OwningProcess) ($name)."
    }
}
