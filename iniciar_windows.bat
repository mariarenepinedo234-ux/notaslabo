@echo off
setlocal
call "%~dp0windows\ceicom_windows.bat" iniciar %*
exit /b %errorlevel%
