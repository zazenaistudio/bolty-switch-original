@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0\.."

title Bolty Switch - Generar EXE

echo ============================================================
echo  BOLTY SWITCH - COMPILACION DE RELEASE PARA WINDOWS
echo ============================================================
echo.

if not exist ".venv\Scripts\python.exe" (
  echo [INFO] Preparando el entorno de desarrollo...
  call scripts\setup_tauri_windows.bat
  if errorlevel 1 exit /b 1
)

call scripts\doctor_tauri_windows.bat
if errorlevel 1 (
  echo.
  echo [ERROR] El entorno no esta preparado.
  echo Ejecuta scripts\setup_tauri_windows.bat despues de instalar los requisitos indicados.
  exit /b 1
)

call ".venv\Scripts\activate.bat"
if errorlevel 1 exit /b 1

echo [1/5] Ejecutando pruebas Python...
python -m pytest -q
if errorlevel 1 exit /b 1

echo [2/5] Auditando las tareas integradas...
python -m bolty_switch.tools.task_doctor
if errorlevel 1 exit /b 1

echo [3/5] Generando el backend ejecutable...
call scripts\build_backend_sidecar.bat
if errorlevel 1 exit /b 1

echo [4/5] Comprobando TypeScript...
pushd frontend
call npm run typecheck
if errorlevel 1 (
  popd
  exit /b 1
)

echo [5/5] Compilando Bolty Switch e instaladores...
call npm run tauri build
set "BUILD_RESULT=%ERRORLEVEL%"
popd
if not "%BUILD_RESULT%"=="0" exit /b %BUILD_RESULT%

powershell -NoProfile -ExecutionPolicy Bypass -File scripts\collect_release.ps1
if errorlevel 1 exit /b 1

echo.
echo ============================================================
echo  RELEASE GENERADA CORRECTAMENTE
echo ============================================================
echo Los instaladores .exe y .msi estan en la carpeta release\
echo.
explorer "%CD%\release"
exit /b 0
