# Proyecto: Sistema de Control Académico de Capacitaciones CEICOM

## Instrucción para Codex
Construye una aplicación de escritorio **portable para Windows 11**, en español, para un docente que registra estudiantes, cursos, notas y emite **dos informes mensuales separados**. No construyas la solución principal en Excel. Implementa un proyecto ejecutable, con código fuente completo, pruebas y guía de compilación; exporta las planillas a Excel y PDF.

## Tecnologías preferidas
- Python 3.12+ con PySide6 (interfaz de escritorio), SQLite (base de datos local), openpyxl (exportación Excel), reportlab o equivalente (PDF), PyInstaller para crear `SistemaAcademico.exe`.
- Funciona offline, sin servidor ni internet, en carpeta portable dentro de USB. Resolver rutas relativas al ejecutable y ubicar datos en una carpeta `datos` al lado del exe, con alternativa documentada si el USB es de solo lectura.
- No depender de Excel ni de Python instalados para ejecutar el `.exe`. El sistema debe probarse en Windows; si el entorno de Codex no es Windows, proporcionar comandos/scripts para construir el exe en Windows y NO afirmar que el exe ya fue probado.

## Objetivo de negocio
El docente imparte cursos de capacitación de Diseño Gráfico y cursos sueltos. Cada mes presenta calificaciones a dirección académica. Necesita capturar estudiantes una sola vez, asignarlos a uno o más cursos, colocar notas y generar informes por período sin volver a escribir nombres ni perder antecedentes.

### Categorías y catálogo exacto inicial
**Categoría 1: Diseño Gráfico (12 cursos)**
1. Illustrator
2. Photoshop
3. InDesign
4. QuarkXPress
5. CorelDRAW
6. 3D Max
7. Vectorworks
8. AutoCAD
9. AutoCAD Architectural
10. Archicad
11. Premiere
12. Sony Vegas

**Categoría 2: Paquetes Sueltos (8 cursos)**
1. Python
2. Java
3. SolidWorks
4. Revit
5. Inteligencia Artificial
6. Marketing Digital
7. Power BI
8. Filmora

**Aclaración crítica:** incluso en Diseño Gráfico, los alumnos pueden inscribirse solo a uno o varios cursos individuales; NO asumir que todos se inscriben al paquete completo. Permitir que un mismo estudiante curse varios cursos en cualquiera de las dos categorías. Mantener cada inscripción independiente; permitir futuras ediciones del catálogo.

### Turnos y referencia institucional
- Turnos observados en el informe facilitado: mañana 08:00–12:00, tarde 15:00–18:00, noche 18:00–21:00; días lunes, miércoles y viernes. Hacer horarios configurables por curso/grupo, no codificarlos rígidamente.
- Instituto: CEICOM; colores guindo, amarillo y gris. Carta dirigida a la Directora Académica (en la muestra: Lic. Maren Mendoza D.), con datos editables en Configuración, incluidas firmas/nombres/cargos; no inventar datos oficiales.
- Muestra suministrada: documento `Noviembre 2026.docx`, con planillas de notas de Diseño Gráfico de tres turnos, encabezados institucionales, carta de entrega y múltiples columnas de programas. Si Codex recibe este archivo, úsalo como referencia visual y de estructura, sin suponer que todos los estudiantes listados pertenecen al paquete completo. La fecha del documento es 04/11/2026 y refiere a las notas de octubre: diferenciar **mes académico de notas** de **fecha/mes de entrega**.

## Regla operativa PRINCIPAL (confirmada por el usuario)
**Una inscripción deja de aparecer en informes PENDIENTES futuros solo después de que el docente confirma expresamente que su nota YA FUE PRESENTADA.**
- Registrar una nota, por sí solo, NO significa presentada y NO debe ocultar la inscripción.
- Al generar la vista previa del informe, NO cambiar el estado a presentada.
- Al confirmar entrega, registrar fecha/hora, período informado, ID de informe, usuario/responsable si aplica, e incluir solo las inscripciones/notas marcadas explícitamente como parte de ese informe.
- Nunca borrar registros históricos al confirmar entrega.
- Si la inscripción tiene varias notas/hitos por curso, controlar presentación a nivel de calificación/hito/reportable para que no se pierdan notas pendientes. En la MVP, una nota final por inscripción es suficiente, pero diseñar extensibilidad para notas parciales.
- No volver a incluir notas ya presentadas en informes pendientes de los siguientes meses. Sí incluirlas al consultar/REIMPRIMIR un informe histórico ya cerrado.
- Si un alumno cursa Illustrator y Photoshop, que Illustrator esté presentado NO implica que Photoshop también esté presentado.
- Permitir corrección posterior con historial de cambios y una función explícita de rectificación/versionado; **no alterar silenciosamente** informes históricos presentados.

## Historial y recuperación
- Consultar reportes por categoría, año, mes, turno y estado (borrador, presentado, rectificado).
- Cada informe cerrado debe almacenar una **instantánea inmutable** de su contenido (filas, notas, nombres, encabezado, fecha de cierre), separada de las tablas editables, y exportarse a PDF y XLSX.
- Permitir regenerar exactamente el documento archivado incluso si luego cambia el nombre o el curso de un alumno. Guardar también copias PDF/XLSX en `Informes/AAAA/MM/` con nombres predecibles y libres de colisiones.
- Sistema de respaldo de SQLite y de archivos de informes con botón `Crear copia de seguridad`, guardando en carpeta elegida y señalando si se guarda en la misma USB (riesgo de perder ambos). Implementar restauración segura con confirmación y validación.
- Considerar transacciones para evitar cierres parciales, impedir duplicación involuntaria de presentaciones y conservar trazabilidad.

## Módulos / pantallas
1. **Panel principal:** estudiantes totales, inscripciones activas, notas pendientes, informes por mes y accesos rápidos.
2. **Estudiantes:** agregar, buscar, editar, desactivar; campos recomendados: ID interno, nombres y apellidos, CI opcional, teléfono opcional, fecha de alta, observaciones; no exigir datos innecesarios.
3. **Inscripciones:** alumno, curso, categoría heredada, fecha de ingreso, turno, estado (activo, concluido, retirado), fecha de finalización opcional. Evitar duplicados accidentales y permitir reinscripciones deliberadas.
4. **Calificaciones:** filtro por turno/curso/mes; valor de nota y observaciones; validar escala configurable (por defecto 0–100), guardar borrador y diferenciar `sin nota` de cero.
5. **Informes:** seleccionar período, generar **DOS informes separados**: (a) Diseño Gráfico; (b) Paquetes Sueltos. Poder desglosarlos por turno, según corresponda, sin mezclar categorías. El usuario revisa vista previa y selecciona qué registros incluir; al confirmar entrega se cierra un informe y se marcan únicamente esas notas como presentadas. Si no existen notas pendientes para una categoría, informar claramente y no emitir un informe vacío por defecto.
6. **Historial:** listar informes presentados, consultar sus estudiantes y notas, reexportar PDF/XLSX, rectificar con una nueva versión si es necesario.
7. **Configuración:** institución, destinatario, docente, firmas, horario, catálogo, escala, logo opcional y rutas de archivo.

## Diseño de los informes
- Mejorar el formato suministrado: apariencia institucional limpia, tipografía legible, logo opcional, encabezado con mes académico y fecha real de presentación, turno(s), número/versión de informe, destinatario, texto formal y espacio de firma.
- **Informe Diseño Gráfico**: tabla con N°, estudiante, fecha/mes de ingreso, curso(s) individuales cursados, nota(s), turno y observaciones. El diseño puede usar columnas por curso si cabe sin perder legibilidad; preferir filas por inscripción cuando haya muchos cursos. Agrupar por turno y ofrecer página separada por turno.
- **Informe Paquetes Sueltos**: tabla con N°, estudiante, curso individual, nota, turno, ingreso y observaciones, agrupable por curso y turno.
- Además, opcionalmente, un resumen de avance mensual (contenidos impartidos) separado de notas; pedir datos específicos si hace falta, no inventarlos.
- Exportar XLSX editable e informe PDF listo para imprimir tamaño carta, en horizontal si el ancho lo requiere; paginar correctamente, repetir encabezados y mostrar totales relevantes.

## Modelo de datos sugerido
- `students(id, nombres, apellidos, ci, telefono, created_at, active, ...)`
- `courses(id, nombre, categoria, activo)`
- `enrollments(id, student_id, course_id, turno, fecha_ingreso, fecha_fin, estado, ...)`
- `grades(id, enrollment_id, tipo, valor, periodo_academico, observacion, created_at, updated_at, ...)`
- `reports(id, categoria, periodo_academico, fecha_presentacion, turno/opciones, estado, version, created_at, confirmado_at, ...)`
- `report_items(id, report_id, grade_id, enrollment_id, snapshot_json, ...)`
- `audit_log(id, entidad, entidad_id, accion, antes_json, despues_json, fecha, ...)`
Usar SQLite con claves foráneas, restricciones e índices. Conservar los nombres usados al momento de entrega mediante snapshots.

## Comportamiento de ejemplo para pruebas
- Juan se inscribe a Illustrator y Photoshop. La nota de Illustrator se presenta en noviembre; Photoshop queda sin presentar. En diciembre Juan debe aparecer como pendiente SOLO para Photoshop.
- María tiene nota final de Power BI registrada, pero no confirmada. Debe seguir en pendientes hasta confirmar entrega.
- Luego de cerrar el informe de noviembre, se puede volver a emitir idéntico desde Historial en enero, sin incluirlo como pendiente de enero.
- La vista previa de diciembre no debe marcar automáticamente las notas como presentadas.
- Un informe de Diseño Gráfico jamás contiene registros de Python/Power BI; un informe de Paquetes Sueltos jamás contiene Illustrator/Photoshop.
- Corregir una inscripción ya incluida en un informe histórico no modifica la instantánea archivada; si es necesaria rectificación crear nueva versión.

## Entregables solicitados
1. Proyecto completo, organizado y comentado en español.
2. App gráfica usable, no solo diseño o Excel estático.
3. SQLite creada automáticamente y catálogo inicial sembrado sin duplicación.
4. Datos de DEMOSTRACIÓN explícitamente ficticios, separados de la base de producción.
5. Pruebas para reglas de presentación y reportes/historial.
6. `README.md` con ejecución y compilación en Windows y `.bat` para construir portable con PyInstaller.
7. Exportación PDF y XLSX validada.
8. Guía breve de usuario con ejemplos de registro, cierre mensual y reimpresión.
9. Si es posible, un ZIP distribuible del programa portable con carpetas de datos e informes, sin inventar ejecutables inexistentes.

## Prioridades de implementación
Primero base de datos + estudiantes/cursos/inscripciones; después calificaciones; luego generador de 2 informes y confirmación de entrega; finalmente historial con instantáneas, exportación y respaldos. Hacer la interfaz intuitiva para un docente y evitar requerir conocimientos técnicos.

## Restricciones y decisiones pendientes
- No asumir que un alumno se retira o desaparece del sistema por terminar una nota; solo cambia el estado reportable de su calificación.
- Distinguir mes al que corresponde la nota y mes en que se entrega el informe, pues el ejemplo de noviembre reporta octubre.
- No hay requisito confirmado para una única calificación mensual general por alumno. Basar MVP en notas por curso individual e inscripción, ampliable.
- Validar que la publicación mensual no seleccione registros sin calificación, salvo que se quiera una lista de avance/pendientes aparte.
- La aplicación es para uso local por un docente; no prometer sincronización multiusuario ni protección absoluta ante pérdida de USB.
