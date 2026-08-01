@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

 echo [1/6] Comprobando Python compatible...
where py >nul 2>nul
if errorlevel 1 (
  echo ERROR: No se encontro el lanzador de Python ^(py.exe^).
  echo Instala Python 3.11, 3.12 o 3.13 de 64 bits y vuelve a ejecutar este script.
  exit /b 1
)

set "PY_CMD="
py -3.12 -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 12) else 1)" >nul 2>nul && set "PY_CMD=py -3.12"
if not defined PY_CMD py -3.13 -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 13) else 1)" >nul 2>nul && set "PY_CMD=py -3.13"
if not defined PY_CMD py -3.11 -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 11) else 1)" >nul 2>nul && set "PY_CMD=py -3.11"
if not defined PY_CMD py -c "import sys; raise SystemExit(0 if (3, 11) <= sys.version_info[:2] < (3, 14) else 1)" >nul 2>nul && set "PY_CMD=py"

if not defined PY_CMD (
  echo ERROR: Bolty Switch requiere Python 3.11, 3.12 o 3.13.
  echo Versiones detectadas:
  py -0p
  exit /b 1
)

for /f "delims=" %%V in ('%PY_CMD% -c "import sys; print(sys.version.split()[0])"') do set "PY_VERSION=%%V"
echo Python seleccionado: %PY_VERSION%

 echo [2/6] Creando o validando el entorno virtual...
if not exist ".venv\Scripts\python.exe" (
  %PY_CMD% -m venv .venv
  if errorlevel 1 (
    echo ERROR: No se pudo crear .venv.
    echo Comprueba que Python incluye el modulo venv y que la carpeta del proyecto tiene permisos de escritura.
    exit /b 1
  )
)

call ".venv\Scripts\activate.bat"
if errorlevel 1 (
  echo ERROR: No se pudo activar .venv.
  exit /b 1
)

python -c "import sys; print('Entorno virtual:', sys.executable)"
if errorlevel 1 exit /b 1

python -m pip install --upgrade pip
if errorlevel 1 exit /b 1
python -m pip install -r requirements-dev.txt
if errorlevel 1 exit /b 1

 echo [3/6] Comprobando Node.js y npm...
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js no encontrado. Instala una version LTS compatible y reinicia la terminal.
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm no encontrado.
  exit /b 1
)
node -e "const [M,m]=process.versions.node.split('.').map(Number); process.exit(((M===20&&m>=19)||(M===22&&m>=12)||M>22)?0:1)"
if errorlevel 1 (
  echo ERROR: La version de Node.js no es compatible con Vite 7.
  echo Se requiere Node 20.19+, 22.12+ o una version LTS posterior.
  node -v
  exit /b 1
)
node -v
call npm -v
if errorlevel 1 (
  echo ERROR: npm fue detectado, pero no pudo ejecutarse.
  exit /b 1
)

 echo [4/6] Instalando dependencias del frontend...
pushd frontend
if errorlevel 1 (
  echo ERROR: No se pudo abrir la carpeta frontend.
  exit /b 1
)
call npm install
set "NPM_RESULT=%ERRORLEVEL%"
popd
if not "%NPM_RESULT%"=="0" (
  echo ERROR: npm install termino con el codigo %NPM_RESULT%.
  exit /b %NPM_RESULT%
)

 echo [5/6] Comprobando Rust y el toolchain MSVC...
where cargo >nul 2>nul
if errorlevel 1 goto :rust_missing
where rustup >nul 2>nul
if errorlevel 1 goto :rust_missing
rustup default stable-msvc >nul 2>nul
if errorlevel 1 (
  echo ERROR: No se pudo seleccionar el toolchain stable-msvc.
  echo Ejecuta: rustup toolchain install stable-msvc
  echo Despues:  rustup default stable-msvc
  exit /b 1
)
cargo --version
rustc --version

 echo [6/6] Validando la instalacion...
if not exist ".venv\Scripts\python.exe" (
  echo ERROR: Falta .venv\Scripts\python.exe.
  exit /b 1
)
if not exist "frontend\node_modules\.bin\tauri.cmd" (
  echo ERROR: No se encontro la CLI local de Tauri. Revisa npm install.
  exit /b 1
)

python -m bolty_switch.tools.task_doctor
if errorlevel 1 (
  echo ERROR: La auditoria de las 70 tareas integradas ha fallado.
  exit /b 1
)

echo.
echo Preparacion completada correctamente.
echo Desarrollo: scripts\run_tauri_dev.bat
echo Generar EXE: BUILD_EXE.bat
exit /b 0

:rust_missing
echo.
echo ERROR: Rust no esta instalado o no esta disponible en PATH.
echo Tauri necesita Rust y Microsoft C++ Build Tools para arrancar en Windows.
echo.
echo 1. Instala Visual Studio Build Tools con "Desktop development with C++".
echo 2. Instala Rust con: winget install --id Rustlang.Rustup
ECHO 3. Cierra y vuelve a abrir VS Code.
echo 4. Ejecuta: rustup default stable-msvc
echo 5. Vuelve a ejecutar este script.
echo.
echo El entorno Python y las dependencias npm ya han quedado preparados.
exit /b 2
