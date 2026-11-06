@echo off
setlocal
set "CEICOM_ACTION=%~1"
set "CEICOM_LOG=%TEMP%\CEICOM_%CEICOM_ACTION%.log"
pushd "%~dp0.."
if errorlevel 1 goto folder_error
echo CEICOM - Preparando %CEICOM_ACTION%
echo El primer inicio necesita Internet para instalar dependencias.
echo Espere mientras se prepara el programa. Puede tardar varios minutos.
echo Registro: %CEICOM_LOG%
echo.
call :run %* > "%CEICOM_LOG%" 2>&1
set "CEICOM_RESULT=%errorlevel%"
type "%CEICOM_LOG%"
echo.
if not "%CEICOM_RESULT%"=="0" (
  echo NO SE PUDO COMPLETAR. Copie el error de arriba o comparta el registro:
  echo %CEICOM_LOG%
) else (
  echo Operacion completada.
)
popd
if not defined CI if not "%CEICOM_NO_PAUSE%"=="1" pause
exit /b %CEICOM_RESULT%

:folder_error
echo No se pudo abrir la carpeta del proyecto. Extraiga todo el ZIP antes de ejecutar.
if not defined CI if not "%CEICOM_NO_PAUSE%"=="1" pause
exit /b 1

:run
if not exist main.py (
  echo Falta main.py. Extraiga TODO el ZIP con Extraer todo y ejecute desde la carpeta extraida.
  exit /b 1
)
if not exist requirements.txt (
  echo Falta requirements.txt. La descarga no se extrajo completamente.
  exit /b 1
)
rem Reutilizar un entorno valido; no exigir el lanzador py si ya existe.
if exist .venv\Scripts\python.exe (
  .venv\Scripts\python.exe -c "import sys,struct; assert sys.version_info[:2]==(3,12) and struct.calcsize('P')==8"
  if not errorlevel 1 goto dependencies
  echo El entorno .venv existente no usa Python 3.12 de 64 bits.
  echo Renombre .venv y vuelva a ejecutar. No se borrara automaticamente.
  exit /b 1
)
if defined CEICOM_PYTHON goto custom_python
py -3.12 -c "import sys,struct; assert sys.version_info[:2]==(3,12) and struct.calcsize('P')==8" >nul 2>&1
if not errorlevel 1 goto create_py
python -c "import sys,struct; assert sys.version_info[:2]==(3,12) and struct.calcsize('P')==8" >nul 2>&1
if not errorlevel 1 goto create_python
:no_python
echo No se encontro Python 3.12 de 64 bits.
echo Instale Python 3.12 x64 desde https://www.python.org/downloads/windows/
echo Active el lanzador py o la opcion Add python.exe to PATH durante la instalacion.
echo Despues cierre esta ventana y vuelva a ejecutar el archivo BAT.
echo Python solo es necesario para iniciar desde codigo o compilar el EXE.
exit /b 1

:custom_python
"%CEICOM_PYTHON%" -c "import sys,struct; assert sys.version_info[:2]==(3,12) and struct.calcsize('P')==8" >nul 2>&1
if errorlevel 1 goto no_python
"%CEICOM_PYTHON%" -m venv .venv
if errorlevel 1 goto venv_error
goto dependencies

:create_py
py -3.12 -m venv .venv
if errorlevel 1 goto venv_error
goto dependencies

:create_python
python -m venv .venv
if errorlevel 1 goto venv_error
goto dependencies

:venv_error
echo No se pudo crear .venv. Extraiga el proyecto en una carpeta escribible, por ejemplo Documentos\CEICOM.
exit /b 1

:dependencies
if /i "%CEICOM_ACTION%"=="compilar" goto build
rem Inicios posteriores funcionan sin red si las bibliotecas ya estan instaladas.
.venv\Scripts\python.exe -c "import PySide6,openpyxl,reportlab" >nul 2>&1
if not errorlevel 1 goto launch
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (
  echo Fallo la instalacion. Revise la conexion a Internet y el error de pip de arriba.
  exit /b 1
)

:launch
echo Iniciando CEICOM...
rem Los wrappers pasan la accion como primer argumento; el programa ignora ese argumento.
.venv\Scripts\python.exe main.py %*
exit /b %errorlevel%

:build
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
if errorlevel 1 exit /b 1
set "QT_QPA_PLATFORM=offscreen"
.venv\Scripts\python.exe -m pytest -q
if errorlevel 1 exit /b 1
set "QT_QPA_PLATFORM="
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
exit /b 0
