@echo off
cd /d "%~dp0"
set "PREVIEW_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%PREVIEW_NODE%" (
  "%PREVIEW_NODE%" serve-preview.mjs
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js is needed. Please install Node.js 22 or later.
  ) else (
    node serve-preview.mjs
  )
)
pause
