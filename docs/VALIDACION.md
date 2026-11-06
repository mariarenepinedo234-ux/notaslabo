# Validación de la primera versión

Entorno ejecutado: Linux, Python 3.12.14, PySide6 6.8.3 con plataforma Qt offscreen.

Comando ejecutado desde el repositorio:

```sh
QT_QPA_PLATFORM=offscreen /workspace/ceicom-venv/bin/python -m pytest -q
```

Resultado: **14 passed**. La instalación reutilizable también se ejecutó por segunda vez y terminó con las mismas 14 pruebas aprobadas.

Comprobaciones realizadas:

- Apertura de las siete pantallas, carga de catálogo y datos ficticios; filtros combinados de Historial.
- Sembrado idempotente de los 20 cursos exactos.
- Notas guardadas y vistas previas sin presentación automática.
- Entrega seleccionada por curso, categorías separadas y arrastre de pendientes.
- Diferencia entre ausencia de nota y cero; validación de escala y períodos.
- Prevención de duplicados de inscripción, con reinscripción deliberada.
- Rechazo de cierre repetido y de vistas previas obsoletas, sin cierre parcial.
- Conservación de instantáneas y bloqueo de modificación histórica.
- Rectificación versionada, conservando versión anterior y sin reabrir pendientes.
- Lectura real de PDF con pypdf y de XLSX con openpyxl, verificando datos.
- Paginación con 66 calificaciones y observaciones largas; encabezados repetidos.
- Celdas de nombres tratadas como texto, no como fórmulas Excel.
- Respaldo SQLite + informes, checksums, restauración confirmada, conservación de copia previa y rechazo de archivo alterado.

Se generaron dos informes de demostración (datos explícitamente ficticios), con notas de octubre de 2026 y entrega el 4 de noviembre. Se inspeccionaron visualmente capturas de la interfaz y una página PDF renderizada. Se incluyeron fuentes en PDF para no depender de las fuentes del equipo destino.

**No ejecutado:** compilación PyInstaller para Windows, prueba del exe en Windows 11, impresión física y uso en USB real. `build_windows.bat` y el flujo de GitHub Actions preparan esas comprobaciones en Windows. El ZIP de fuentes no es un portable compilado. No se ha publicado el entorno ni ejecutado el flujo remoto de GitHub Actions.

## Corrección del inicio en Windows

La suite actual ejecutada en Linux terminó con **16 passed, 2 skipped**. Las dos pruebas omitidas necesitan cmd.exe de Windows y verifican que ambos BAT informan correctamente cuando falta Python, incluso en carpetas con espacios. Se probaron también fallos de importación de Qt y de acceso a datos, con mensaje de error y registro. Los BAT conservan los códigos de salida y mantienen la consola abierta fuera de CI. El flujo de GitHub Actions incluye ahora la rama ceicom-primera-version para validar y compilar en Windows tras subir cambios; su ejecución remota no se da por aprobada desde Linux.
