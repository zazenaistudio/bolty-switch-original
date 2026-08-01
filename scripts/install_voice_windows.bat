@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0\.."

if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] No se encontro .venv.
  echo Ejecuta primero scripts\setup_tauri_windows.bat
  exit /b 1
)

call ".venv\Scripts\activate.bat"
python -m pip install -r requirements-backend.txt
if errorlevel 1 exit /b 1

python -c "from backend.voice_engine import VoiceEngine; r=VoiceEngine().install_model('es'); print(r.get('message','Modelo instalado')); print('Ruta:',r.get('model_path',''))"
if errorlevel 1 exit /b 1

echo [OK] Reconocimiento de voz preparado.
exit /b 0
