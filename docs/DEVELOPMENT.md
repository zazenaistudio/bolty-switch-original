# Desarrollo y compilación de Bolty Switch

## Requisitos de Windows

- Windows 10 u 11 de 64 bits.
- Python 3.11, 3.12 o 3.13 de 64 bits.
- Node.js 22 LTS.
- Rust estable con toolchain MSVC.
- Visual Studio Build Tools con **Desktop development with C++**.
- Microsoft Edge WebView2 Runtime.

## Preparar el entorno

Desde la raíz del repositorio:

```bat
scripts\setup_tauri_windows.bat
```

El script crea `.venv`, instala el backend Python, instala las dependencias del frontend y comprueba Rust/Tauri.

## Ejecutar en desarrollo

```bat
scripts\run_tauri_dev.bat
```

El frontend se abre dentro de Tauri y se comunica con `backend\ipc_server.py` mediante JSON Lines.

## Ejecutar pruebas

```bat
.venv\Scripts\python -m pytest -q
.venv\Scripts\python -m bolty_switch.tools.task_doctor
scripts\test_ipc.bat
```

## Generar el ejecutable e instaladores

La forma recomendada es ejecutar:

```bat
BUILD_EXE.bat
```

El proceso realiza cuatro pasos:

1. Ejecuta las pruebas y la auditoría de tareas.
2. Compila `backend\ipc_server.py` como `backend\bolty-backend.exe` mediante PyInstaller.
3. Compila React/Vite y el shell Tauri/Rust.
4. Genera instaladores NSIS `.exe` y WiX `.msi`.

Los resultados se copian a:

```text
release\Bolty-Switch-v0.6.6\
```

Tauri también deja los artefactos originales en:

```text
frontend\src-tauri\target\release\bundle\
```

## Publicar con GitHub Actions

- `.github/workflows/windows-build.yml` valida el repositorio y guarda los instaladores como artefactos.
- `.github/workflows/windows-release.yml` se ejecuta al subir una etiqueta `v*` y publica los instaladores en GitHub Releases.

```bash
git tag v0.6.6
git push origin v0.6.6
```

## Reconocimiento de voz

Las dependencias de Vosk forman parte de `requirements-backend.txt`. El modelo se descarga la primera vez que se activa el micrófono y se guarda en:

```text
%APPDATA%\Zazen AI Studio\Bolty Switch\models\vosk-es
```

También puede instalarse previamente:

```bat
scripts\install_voice_windows.bat
```

## Datos del usuario

Los eventos, ajustes, registros y modelos de voz se almacenan en:

```text
%APPDATA%\Zazen AI Studio\Bolty Switch\
```

## Comprobación antes de publicar

1. Instala el `.exe` en una máquina Windows limpia.
2. Comprueba el inicio, los widgets, el micrófono, la bandeja y las 70 tareas.
3. Verifica resoluciones 1280×720, 1366×768, Full HD y escalado de Windows.
4. Firma el instalador con un certificado de firma de código antes de una distribución pública amplia.
5. Publica `SHA256SUMS.txt` junto a los instaladores.
