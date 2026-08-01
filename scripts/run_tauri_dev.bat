@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

if not exist ".venv\Scripts\python.exe" (
  echo ERROR: No existe .venv\Scripts\python.exe.
  echo Ejecuta primero: scripts\setup_tauri_windows.bat
  exit /b 1
)

where cargo >nul 2>nul || (
  echo ERROR: Cargo/Rust no esta disponible en esta terminal.
  echo Instala Rust con: winget install --id Rustlang.Rustup
  echo Despues cierra y vuelve a abrir VS Code y ejecuta:
  echo rustup default stable-msvc
  exit /b 2
)

if not exist "frontend\node_modules\.bin\tauri.cmd" (
  echo ERROR: Faltan las dependencias npm del frontend.
  echo Ejecuta primero: scripts\setup_tauri_windows.bat
  exit /b 3
)

set "BOLTY_PYTHON=%CD%\.venv\Scripts\python.exe"
call ".venv\Scripts\activate.bat"
if errorlevel 1 exit /b 1

echo [Bolty] Validando backend Python y base de datos...
"%BOLTY_PYTHON%" -c "from bolty_switch.database import Database; Database(); print('Backend Python listo.')"
if errorlevel 1 (
  echo ERROR: El backend Python no pudo inicializarse.
  echo Revisa el mensaje anterior. Tus eventos no se eliminan automaticamente.
  exit /b 4
)

pushd frontend
call npm run tauri dev
set "RESULT=%ERRORLEVEL%"
popd
exit /b %RESULT%
