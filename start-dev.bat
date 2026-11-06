@echo off
title Sangoub Dev Server
cd /d d:\Sangoub
echo ==============================================
echo   Starting Sangoub Platform (http://localhost:3000)
echo ==============================================
"C:\Users\MeskL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" ./node_modules/tsx/dist/cli.mjs server.ts
pause

