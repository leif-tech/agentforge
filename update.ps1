# AgentForge Auto-Updater
# Run this whenever Claude tells you there's an update: .\update.ps1

$REPO = $PSScriptRoot
Set-Location $REPO

Write-Host ""
Write-Host "  AgentForge Updater" -ForegroundColor Cyan
Write-Host "  ==================" -ForegroundColor Cyan
Write-Host ""

# Pull latest from GitHub
Write-Host "Pulling latest changes..." -ForegroundColor Yellow
git pull origin main

# Restart server
Write-Host ""
Write-Host "Restarting server..." -ForegroundColor Yellow
npx kill-port 3000
Start-Sleep -Seconds 1
Start-Process cmd -ArgumentList "/k npm start" -WorkingDirectory $REPO

Write-Host ""
Write-Host "Done! Server restarting at localhost:3000" -ForegroundColor Green
Write-Host ""
