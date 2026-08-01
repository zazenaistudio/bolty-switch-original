@echo off
setlocal
cd /d "%~dp0\.."
rmdir /s /q build 2>nul
rmdir /s /q dist 2>nul
rmdir /s /q release 2>nul
rmdir /s /q .pytest_cache 2>nul
rmdir /s /q .ruff_cache 2>nul
rmdir /s /q frontend\dist 2>nul
rmdir /s /q frontend\src-tauri\target 2>nul
del /q backend\bolty-backend.exe 2>nul
for /d /r %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d"
echo Limpieza completada.
