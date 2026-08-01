@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] No existe .venv. Ejecuta scripts\setup_tauri_windows.bat
  exit /b 1
)

call ".venv\Scripts\activate.bat"
if errorlevel 1 exit /b 1

python -m pip install --disable-pip-version-check -r requirements-dev.txt
if errorlevel 1 exit /b 1

if exist "build\bolty-backend" rmdir /s /q "build\bolty-backend"
if exist "dist\bolty-backend.exe" del /q "dist\bolty-backend.exe"
if exist "backend\bolty-backend.exe" del /q "backend\bolty-backend.exe"

python -m PyInstaller ^
  --noconfirm ^
  --clean ^
  --onefile ^
  --name bolty-backend ^
  --icon "frontend\src-tauri\icons\icon.ico" ^
  --paths . ^
  --collect-submodules bolty_switch ^
  --collect-all vosk ^
  --collect-all sounddevice ^
  "backend\ipc_server.py"
if errorlevel 1 exit /b 1

copy /y "dist\bolty-backend.exe" "backend\bolty-backend.exe" >nul
if errorlevel 1 exit /b 1

echo [OK] Backend generado: backend\bolty-backend.exe
exit /b 0
