@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0\.."

set "PYTHON=.venv\Scripts\python.exe"
if not exist "%PYTHON%" set "PYTHON=%LOCALAPPDATA%\BoltySwitch\venv\Scripts\python.exe"
if not exist "%PYTHON%" (
  echo [ERROR] No se encontro el entorno Python de Bolty Switch.
  echo Ejecuta primero scripts\setup_tauri_windows.bat o scripts\setup_windows.bat.
  exit /b 1
)

echo [1/2] Ejecutando pruebas automatizadas de las 70 tareas...
"%PYTHON%" -m pytest tests\test_windows_tasks.py -q
if errorlevel 1 exit /b 1

echo [2/2] Ejecutando diagnostico de componentes de Windows...
"%PYTHON%" -m bolty_switch.tools.task_doctor
if errorlevel 1 exit /b 1

echo.
echo [OK] Las 70 tareas estan registradas y tienen un plan de ejecucion valido.
exit /b 0
