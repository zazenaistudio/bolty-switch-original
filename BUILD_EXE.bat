@echo off
setlocal
cd /d "%~dp0"
call scripts\build_release_windows.bat
exit /b %ERRORLEVEL%
