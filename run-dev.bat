@echo off
cd /d "D:\Sangoub"
echo Starting Sangoub Local Development Server...
"C:\Users\MeskL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" .\node_modules\tsx\dist\cli.mjs server.ts
pause

