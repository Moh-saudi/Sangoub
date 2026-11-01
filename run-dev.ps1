Set-Location "D:\Sangoub"
Write-Host "Starting Sangoub Local Development Server on http://localhost:3000..." -ForegroundColor Green
& "C:\Users\MeskL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" .\node_modules\tsx\dist\cli.mjs server.ts

