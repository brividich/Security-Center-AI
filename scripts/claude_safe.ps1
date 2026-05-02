# Claude Safe - DEV SAFE sanitization workflow launcher
# Run from repository root

$ErrorActionPreference = "Stop"

Write-Host "=== Claude Safe - DEV SAFE Workflow ===" -ForegroundColor Cyan
Write-Host ""

# Check Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Python not found. Install Python 3.11+ and try again." -ForegroundColor Red
    exit 1
}

# Run sanitization
Write-Host "Running DEV SAFE sanitization..." -ForegroundColor Yellow
python scripts/devsafe_sync.py

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Sanitization failed. Fix errors before starting Claude." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Sanitization complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Sanitized samples location: samples/security/auto/" -ForegroundColor Cyan
Write-Host ""
Write-Host "REMINDER: Claude must use samples/security/ only." -ForegroundColor Yellow
Write-Host "          Do NOT use security_raw_inbox/ with AI agents." -ForegroundColor Yellow
Write-Host ""

# Set safe model env vars if not already set
if (-not $env:ANTHROPIC_MODEL) {
    $env:ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929"
}
if (-not $env:ANTHROPIC_SMALL_FAST_MODEL) {
    $env:ANTHROPIC_SMALL_FAST_MODEL = "claude-sonnet-4-5-20250929"
}

Write-Host "Starting Claude Code..." -ForegroundColor Green
Write-Host ""

# Start Claude Code
claude
