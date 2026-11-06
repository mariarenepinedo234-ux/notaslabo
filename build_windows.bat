@echo off
setlocal
call "%~dp0windows\ceicom_windows.bat" compilar
exit /b %errorlevel%
