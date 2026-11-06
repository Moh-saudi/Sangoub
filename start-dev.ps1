# Sangoub Dev Server Starter for PowerShell
Set-Location "d:\Sangoub"
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  Starting Sangoub Platform (http://localhost:3000)" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan
& "C:\Users\MeskL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" ./node_modules/tsx/dist/cli.mjs server.ts

