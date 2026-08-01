@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

set "FAILED=0"
echo === Bolty Switch - Diagnostico de entorno ===

echo.
echo [Python]
where py >nul 2>nul
if errorlevel 1 (
  echo FALTA: py.exe
  set "FAILED=1"
) else (
  py -0p
)
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" -c "import sys; print(sys.version); print(sys.executable)"
) else (
  echo FALTA: .venv\Scripts\python.exe
  set "FAILED=1"
)

echo.
echo [Node y npm]
where node >nul 2>nul
if errorlevel 1 (
  echo FALTA: node
  set "FAILED=1"
) else (
  node -v
)
where npm >nul 2>nul
if errorlevel 1 (
  echo FALTA: npm
  set "FAILED=1"
) else (
  call npm -v
  if errorlevel 1 (
    echo ERROR: npm no pudo ejecutarse
    set "FAILED=1"
  )
)
if exist "frontend\node_modules\.bin\tauri.cmd" (
  echo OK: Tauri CLI local
) else (
  echo FALTA: npm install en frontend
  set "FAILED=1"
)

echo.
echo [Rust]
where rustup >nul 2>nul
if errorlevel 1 (
  echo FALTA: rustup
  set "FAILED=1"
) else (
  rustup --version
  rustup show active-toolchain
)
where cargo >nul 2>nul
if errorlevel 1 (
  echo FALTA: cargo
  set "FAILED=1"
) else (
  cargo --version
)
where rustc >nul 2>nul
if errorlevel 1 (
  echo FALTA: rustc
  set "FAILED=1"
) else (
  rustc --version
)



echo.
echo [Tareas integradas]
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" -m bolty_switch.tools.task_doctor
  if errorlevel 1 set "FAILED=1"
) else (
  echo No se puede auditar sin el entorno Python.
  set "FAILED=1"
)
echo.
if "%FAILED%"=="0" (
  echo Diagnostico correcto. Puedes ejecutar scripts\run_tauri_dev.bat
  exit /b 0
)

echo Hay requisitos pendientes. Ejecuta scripts\setup_tauri_windows.bat despues de instalarlos.
exit /b 1
