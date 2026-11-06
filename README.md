# CEICOM · Aplicación web de gestión académica

Aplicación local para el navegador, en español. **JavaScript de principio a fin: no usa Python, PySide6, PyInstaller ni un ejecutable Windows.** React + Node.js + SQLite integrado en Node.

## Abrir en Windows

1. Instale **Node.js 24 LTS** desde https://nodejs.org/ (incluye npm).
2. Descargue el proyecto y use **Extraer todo**. Abra una terminal dentro de la carpeta que contiene `package.json`.
3. Ejecute:

```bat
npm.cmd install
npm.cmd run dev
```

El servidor intenta abrir el navegador automáticamente en Windows. Si no se abre, escriba **http://127.0.0.1:3000** en su navegador. Mantenga la terminal abierta mientras utiliza el sistema. Para cerrar, pulse `Ctrl+C` en la terminal.

La instalación inicial necesita Internet. Después de instalar, la aplicación funciona localmente sin Internet; las fuentes, los iconos y los recursos se sirven desde el proyecto. No requiere Excel, Python ni compiladores.

En Linux/macOS, los comandos equivalentes son `npm install` y `npm run dev`.

## Probar el ejemplo

En el panel pulse **Probar con datos ficticios**. También puede entrar en Configuración → Abrir demostración ficticia. La franja amarilla identifica ese espacio. Pulse **Volver a mis datos** para salir.

Los datos de demostración se guardan en `demo/datos/academico.sqlite`, separados de producción (`datos/academico.sqlite`). Se crean dos estudiantes ficticios con Illustrator, Photoshop y Power BI, y notas de octubre de 2026. No se importan estudiantes reales del documento de muestra.

Para abrir la demostración desde la terminal puede usar `npm.cmd run dev:demo`.

## Qué incluye

- Panel con estudiantes, inscripciones activas, notas pendientes e informes cerrados del mes.
- Estudiantes: alta, búsqueda, edición, botones Inactivar/Reactivar e historial individual; CI y teléfono opcionales.
- Inscripciones por curso individual y turno/grupo; horario editable, estados y reinscripción deliberada.
- Calificaciones finales por inscripción, filtros por curso/turno/mes, escala configurable y diferencia entre cero y sin nota.
- Dos informes separados: Diseño Gráfico y Paquetes Sueltos. Selección explícita de notas, borradores y confirmación de entrega.
- Historial filtrable por categoría, año, mes, turno y estado; instantáneas inmutables y rectificaciones con nuevas versiones.
- Planilla como la muestra: una fila por estudiante, cursos como columnas y notas en cada celda. PDF carta vertical hasta 12 cursos (horizontal si hay más), fuentes incorporadas y encabezados repetidos; Excel editable con impresión en carta.
- Copias ZIP de SQLite e informes con checksums y restauración validada con confirmación y respaldo previo.
- Catálogo inicial exacto de 20 cursos y configuración institucional, docente, firmas y horarios.
- Interfaz adaptable a escritorio, tablet y móvil.

## Imprimir la planilla sin repetir estudiantes

Cree una nueva vista previa desde **Informes**. Cada estudiante aparece una sola vez, también si tiene cursos en varios turnos. Siempre se muestran todos los cursos registrados en la categoría: 12 de Diseño Gráfico y 8 de Paquetes Sueltos en el catálogo inicial. Cada celda contiene únicamente la nota seleccionada; «—» significa que no se incluye una calificación de ese curso en el informe. Las columnas sin una nota incluida muestran «—»; esto no inscribe al estudiante a un paquete completo. Dos personas con el mismo nombre se mantienen separadas por ID.

El botón **Abrir PDF para imprimir** abre el archivo en una pestaña. En el visor PDF pulse Imprimir, seleccione papel **Carta** y escala **100 % / Tamaño real**. No use la impresión de la página completa del navegador. La planilla de hasta 12 cursos es carta vertical, como el documento de muestra; con más cursos se utiliza carta horizontal para mantener legibilidad. El Excel también tiene tamaño carta, encabezados verticales y una página de ancho.

Las reinscripciones del mismo alumno/curso conservan todas sus notas, numeradas en la celda y con detalle aparte. Ingreso, turno, observaciones y mes de cada nota se conservan; el detalle usa el número de fila sin volver a imprimir el nombre. Los informes anteriores a esta actualización conservan su formato original, incluso al reconstruir un archivo perdido. Para usar el nuevo formato prepare un informe nuevo; una rectificación crea una versión nueva, nunca reescribe la anterior.

Ejemplo con datos ficticios: [Diseño Gráfico — PDF](ejemplos/Informe_Diseno_Grafico_Carta.pdf), [Paquetes Sueltos — PDF](ejemplos/Informe_Paquetes_Sueltos_Carta.pdf) y sus Excel en la carpeta ejemplos/.

## Inactivar estudiantes sin perder antecedentes

En **Estudiantes**, pulse **Inactivar** junto al nombre. El alumno permanece registrado y puede abrir su **Historial** para consultar todas sus inscripciones, notas, entregas y rectificaciones. Queda excluido de la lista de pendientes y de los informes nuevos de ambas categorías. Sus notas **no se marcan como presentadas** ni se borran. Los informes cerrados anteriores conservan el nombre y las notas originales.

El botón **Reactivar** vuelve a habilitar sus notas sin entrega confirmada; las que ya se presentaron siguen fuera de pendientes. Si inactiva después de crear una vista previa, ese borrador queda obsoleto y debe generar uno nuevo antes de imprimir o confirmar. Así no se imprime por accidente una lista desactualizada.

Cada informe nuevo archiva también el catálogo completo de su categoría, para que futuros cambios de cursos no alteren sus columnas históricas. La nueva distribución se aplica a informes nuevos; los anteriores conservan su formato original.

## Regla principal: guardar no es presentar

Registrar una nota, consultar pendientes, generar una vista previa o descargar un PDF/Excel **no marca la nota como presentada**. Solo la confirmación expresa «YA ENTREGUÉ», con responsable y fecha real, cierra el informe y marca sus notas seleccionadas. Las demás siguen pendientes, también en períodos futuros y aunque se concluya una inscripción; las de alumnos inactivos se conservan fuera de la lista hasta reactivarlos.

Si Illustrator se presenta y Photoshop no, el estudiante seguirá pendiente únicamente por Photoshop. El mes académico de la nota, el período del informe y la fecha real de entrega se conservan de forma independiente.

El cierre verifica que la vista previa siga vigente y usa una transacción SQLite. Los informes históricos, sus filas y las notas presentadas quedan protegidos. Rectificar modifica una **nueva versión del informe**, con motivo y responsable: la nota original sigue en Calificaciones y el valor corregido se consulta en la versión rectificada. No se borran antecedentes.

## Archivos y respaldos

- `datos/academico.sqlite`: base de producción creada automáticamente.
- `Informes/AAAA/MM/`: PDF/XLSX archivados por período, categoría, ID y versión.
- `demo/`: demostración independiente.
- `RespaldosPrevios/`: copias anteriores a una restauración.

El botón **Crear copia de seguridad** descarga un ZIP. El navegador controla la carpeta de descarga; copie el respaldo a otro dispositivo. No se puede detectar desde el navegador si eligió la misma USB. Antes de restaurar se valida estructura, integridad SQLite, CRC y SHA256; se guarda una copia previa. La sustitución se revierte ante errores detectados, sin garantizar recuperación ante un corte eléctrico.

La reexportación conserva los originales archivados byte por byte. Si faltan, los reconstruye desde la instantánea; los bytes pueden variar según las bibliotecas, manteniendo el contenido histórico. No edite directamente los originales internos: descargue copias para modificar Excel.

Para usar otro disco escribible, configure `CEICOM_HOME` antes de iniciar:

```bat
set "CEICOM_HOME=D:\MisDatosCEICOM"
npm.cmd run dev
```

Esta versión crea una base web nueva y no importa automáticamente bases/respaldos de la versión de escritorio. No sobrescriba información antigua: conserve una copia si ya tenía datos reales.

## Compilar y ejecutar la versión optimizada

```bat
npm.cmd run build
npm.cmd start
```

`npm.cmd run dev` inicia directamente la app con recarga de cambios; no requiere ejecutar `build` antes. Para otro puerto: `set "PORT=3001"` antes de iniciar. Si el puerto ya está ocupado, cierre la otra instancia o cambie `PORT`.

## Pruebas

```bat
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Las pruebas de Node cubren reglas académicas, transacciones, categorías, instantáneas, rectificación, PDF/XLSX, respaldo/restauración y API. Las de navegador ejecutan el registro de estudiante, dos inscripciones, notas, exportación, cierre selectivo, arrastre mensual, historial y vista móvil. Todos los tests utilizan carpetas temporales.

En un entorno que ya tenga Chromium, puede definir `CEICOM_CHROMIUM` con la ruta del ejecutable para no descargarlo. Esto solo afecta a las pruebas, no al uso normal de la aplicación.

GitHub Actions valida Node 24 en Linux y Windows. El resultado de cada ejecución se consulta en la pestaña Actions del repositorio; incluir el flujo no implica que ya haya pasado.

## Estructura

- `src/`: interfaz React y estilos.
- `server/store.mjs`: SQLite, validaciones y reglas académicas.
- `server/app.mjs`: API local y serialización de escrituras.
- `server/index.mjs`: inicio único de servidor + Vite.
- `server/exports.mjs`: PDF/XLSX desde instantáneas.
- `server/backup.mjs`: respaldo y restauración.
- `tests/`, `e2e/`: pruebas de Node y navegador.
- `docs/GUIA_USUARIO.md`: guía del docente.

## Alcance

Aplicación local para un docente: el servidor escucha únicamente en `127.0.0.1`. No es un servicio público ni incluye autenticación multiusuario. Otras pestañas comparten los datos del mismo servidor. Las escrituras se serializan, pero use una sola instancia de servidor por carpeta de datos. El historial rechaza cierres repetidos o vistas previas obsoletas.

La primera versión web admite una nota final por inscripción, con el campo `tipo` preparado para ampliar a parciales. No incluye el resumen opcional de contenidos impartidos. Se mantiene la referencia funcional original en `docs/ESPECIFICACIONES.md`; la petición posterior del usuario sustituye la tecnología de escritorio por esta aplicación web.
