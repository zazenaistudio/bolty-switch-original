@echo off
setlocal
cd /d "%~dp0\.."
if not exist .venv\Scripts\python.exe (
  echo Ejecuta primero scripts\setup_tauri_windows.bat
  exit /b 1
)
set REQUEST={"id":"smoke","command":"bootstrap","payload":{}}
echo %REQUEST%| .venv\Scripts\python.exe backend\ipc_server.py
endlocal
