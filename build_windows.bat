@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo Instale Python 3.12 de 64 bits desde python.org. Solo es necesario para compilar.
  exit /b 1
)
py -3.12 -m venv .venv
if errorlevel 1 exit /b 1
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
if errorlevel 1 exit /b 1
set QT_QPA_PLATFORM=offscreen
.venv\Scripts\python.exe -m pytest -q
if errorlevel 1 exit /b 1
set QT_QPA_PLATFORM=
.venv\Scripts\python.exe -m PyInstaller --noconfirm --clean --windowed --onedir --name SistemaAcademico --collect-all reportlab main.py
if errorlevel 1 exit /b 1
if not exist dist\SistemaAcademico\datos mkdir dist\SistemaAcademico\datos
if not exist dist\SistemaAcademico\Informes mkdir dist\SistemaAcademico\Informes
copy /y docs\GUIA_USUARIO.md dist\SistemaAcademico\GUIA_USUARIO.md >nul
copy /y README.md dist\SistemaAcademico\LEEME.md >nul
powershell -NoProfile -Command "Compress-Archive -Path 'dist\SistemaAcademico' -DestinationPath 'dist\CEICOM_Portable_Windows.zip' -Force"
if errorlevel 1 exit /b 1
echo Portable creado: dist\CEICOM_Portable_Windows.zip
echo Extraiga toda la carpeta y ejecute SistemaAcademico.exe. No copie solo el exe.
endlocal
