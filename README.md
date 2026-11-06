# CEICOM · Sistema de control académico

## Descargar esta primera versión

En GitHub, seleccione la rama `ceicom-primera-version` y use **Code → Download ZIP** para descargar el proyecto completo. También está disponible el paquete autocontenido [CEICOM_Fuentes_v1.zip](entregables/CEICOM_Fuentes_v1.zip): abra ese archivo y pulse el botón de descarga de GitHub. Incluye código, pruebas, guía y ejemplos ficticios; es código fuente, no un ejecutable Windows compilado. Los informes de ejemplo están también en [ejemplos_ficticios](ejemplos_ficticios/).

Primera versión funcional de escritorio en español, offline, con Python 3.12+, PySide6 y SQLite. Colores guindo, amarillo y gris. Producción inicia vacía; incluye el catálogo solicitado de 20 cursos, con inscripciones individuales independientes.

## Ejecutar desde el código

En Windows, instale Python **3.12 de 64 bits** y ejecute `iniciar_windows.bat`. Para demostración: `iniciar_windows.bat --demo`.

En Linux (requiere bibliotecas del sistema compatibles con Qt y un escritorio):

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python main.py
# Datos ficticios en carpeta independiente:
.venv/bin/python main.py --demo
```

El modo demo usa `demo/datos` y `demo/Informes`, sin mezclar información con producción. No se importan nombres de estudiantes del documento de referencia.

## Si al ejecutar no aparece nada

Extraiga **todo** el ZIP con «Extraer todo» antes de abrir archivos. Para usar el código, abra `iniciar_windows.bat`; `build_windows.bat` fabrica el portable, no abre directamente la aplicación.

Los BAT comprueban Python **3.12 x64** y dejan el resultado visible hasta pulsar una tecla. Si Python falta, muestran cómo instalarlo. El primer inicio requiere Internet para instalar dependencias; los siguientes reutilizan las bibliotecas instaladas sin descargarlas otra vez.

Si se produce un fallo, copie el texto de la ventana o abra el registro:

- Inicio desde código: `%TEMP%\CEICOM_iniciar.log`.
- Compilación: `%TEMP%\CEICOM_compilar.log`.
- Fallo de la aplicación o del EXE: `%TEMP%\CEICOM_aplicacion.log`.

Pegue esa ruta en la barra de direcciones del Explorador de Windows. El EXE también muestra un aviso nativo cuando falla la importación de la interfaz. Los registros no garantizan capturar fallos nativos de Windows o del propio proceso antes de ejecutar Python.

## Obtener SistemaAcademico.exe en Windows 11

1. Extraiga el código en una carpeta escribible en Windows 11 x64.
2. Instale Python 3.12 x64 con el lanzador `py` (solo en la máquina que compila).
3. Ejecute `build_windows.bat`. Instala dependencias fijadas, ejecuta las pruebas y compila con PyInstaller.
4. Obtendrá `dist/SistemaAcademico/SistemaAcademico.exe` y `dist/CEICOM_Portable_Windows.zip`.
5. Copie **toda la carpeta SistemaAcademico**, incluido `_internal`, a su USB. El equipo destino no necesita Python, Excel, servidor ni Internet. Extraiga el ZIP antes de ejecutar.

También se incluye un flujo de GitHub Actions para compilar en Windows al subir el proyecto o iniciarlo manualmente. Su inclusión no significa que ese flujo se haya ejecutado. PyInstaller compila para el sistema donde se ejecuta; no genera un exe de Windows desde Linux.

**Estado de validación:** las pruebas y la apertura de la interfaz se ejecutaron en Linux con Qt offscreen. El ejecutable Windows y su comportamiento en Windows 11/USB requieren compilación y prueba en Windows; no se entrega un `.exe` ficticio.

## Datos portables y USB de solo lectura

Junto al exe (o `main.py` al desarrollar):

- `datos/ceicom.sqlite3`: SQLite con claves foráneas, restricciones y auditoría.
- `Informes/AAAA/MM/`: PDF y XLSX por **período del informe**; las filas conservan además su propio mes de nota.
- `RespaldosPrevios/`: copia automática antes de restaurar.

Un informe pendiente de noviembre puede incluir una nota de octubre todavía no entregada. La fecha real de presentación se registra aparte. Los nombres incluyen categoría, período, ID y versión para evitar colisiones. Los borradores se identifican como tales en archivos y contenido.

Si el USB no permite escritura, antes de iniciar en CMD:

```bat
set "CEICOM_HOME=%LOCALAPPDATA%\CEICOM"
SistemaAcademico.exe
```

En ese caso los datos quedan en ese equipo, no en el USB: haga respaldo para transportarlos. Use siempre un solo proceso por carpeta de datos; la aplicación utiliza un bloqueo de instancia. Cierre la aplicación antes de retirar el USB.

## Regla de entrega

Guardar una nota y generar/exportar una vista previa **no la presentan**. Solo el cierre explícito de un informe, con responsable y fecha, marca sus notas seleccionadas. Las pendientes se arrastran a meses posteriores, incluso si la inscripción está concluida. Inscripciones sin nota se distinguen de una nota cero y no se incluyen en informes de calificaciones. Cada categoría se procesa por separado; no se emiten informes vacíos.

El cierre usa transacción con bloqueo de escritura y verifica que la vista previa no esté obsoleta. Los informes cerrados tienen instantáneas inmutables de filas, nombres, curso, horario y encabezado, incluido el logo. Las notas presentadas quedan protegidas contra edición. Una corrección genera una versión nueva de la instantánea con motivo, responsable, fecha y enlace a la versión anterior. Las siguientes rectificaciones deben hacerse sobre la versión más reciente. La nota original permanece en Calificaciones para conservar trazabilidad: la corrección se consulta en la versión rectificada del informe.

PDF/XLSX se archivan al cerrar. Si falla la escritura, el cierre queda registrado y puede reintentarse desde Historial. La reexportación copia los originales conservados byte por byte; si se perdieron, reconstruye los documentos desde la instantánea, con el contenido original. Una regeneración con otras versiones de bibliotecas puede producir bytes distintos sin cambiar los datos. No edite manualmente los originales archivados; exporte una copia para editar Excel.

## Pruebas

```sh
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

En Linux sin pantalla: `QT_QPA_PLATFORM=offscreen python -m pytest -q`. Las pruebas cubren entrega explícita, arrastre, cero/sin nota, categorías, duplicados, vistas previas obsoletas, cierre transaccional, historial, rectificaciones, PDF/XLSX, paginación, respaldo/restauración y apertura de las siete pantallas de escritorio. Usan directorios temporales, nunca la base de producción.

## Estructura

- `ceicom/store.py`: esquema SQLite, catálogo, validación, auditoría y reglas de negocio.
- `ceicom/ui.py`: siete pantallas de escritorio y confirmaciones.
- `ceicom/exports.py`: carta y planillas institucionales PDF carta horizontal/XLSX editable.
- `ceicom/backup.py`: SQLite Backup API, ZIP con checksums, validación y restauración con copia previa.
- `ceicom/paths.py`, `demo.py`: portabilidad y demostración separada.
- `tests/`: pruebas automáticas; `docs/GUIA_USUARIO.md`: guía operativa.

## Alcance y límites de esta primera versión

Una nota final por inscripción; el esquema reserva `tipo` para extender a parciales. Las rectificaciones de esta versión corrigen notas (una fila por operación en la interfaz); no reemplazan alumnos ni añaden inscripciones a un informe cerrado. Los turnos y horarios son configurables y cada inscripción conserva su horario. La ruta de datos/informes se configura con `CEICOM_HOME`; no hay selector independiente de archivo. Historial permite combinar filtros por categoría, año, mes, turno y estado, además de buscar por texto. No incluye resumen de contenidos impartidos (opcional), sincronización multiusuario ni firma digital. La configuración institucional comienza sin nombres oficiales: complete destinatario, docente y cargos antes de producir informes reales.

Respaldos: se verifica integridad SQLite y checksums de archivos antes de restaurar; se conserva copia previa. La restauración revierte errores de operación detectados; no sustituye un respaldo en otro dispositivo ni garantiza recuperación ante corte eléctrico durante el reemplazo de archivos.

El diseño toma como referencia la carta y separación por turno del documento `Noviembre 2026.docx`: mejora legibilidad con filas por inscripción, encabezados repetidos, paginación y meses explícitos. El catálogo procede de las especificaciones, ya que la muestra contiene cursos adicionales y columnas que no deben interpretarse como inscripción a un paquete completo.
