# Guía breve · CEICOM

1. **Configuración:** complete institución, destinatario, docente, cargos, texto de firma y logo opcional (PNG/JPG). Ajuste la escala y los horarios. No se presuponen nombres oficiales. Los horarios usan una línea `Turno=Días y horas`; al inscribir puede personalizarlos por grupo. El catálogo permite agregar, editar y desactivar cursos.
2. **Estudiantes:** agregue nombres y apellidos; CI y teléfono son opcionales. Busque por nombre o CI. Editar/desactivar conserva las inscripciones e informes previos.
3. **Inscripciones:** elija estudiante y un curso, turno/grupo, horario y fecha de ingreso. Repita para cada curso individual. El sistema avisa si ya existe una inscripción activa; confirme reinscripción deliberada solo cuando corresponda. Puede registrar conclusión/retiro y fecha final sin eliminar notas pendientes.
4. **Calificaciones:** seleccione inscripción, pulse Guardar nota e indique nota y mes académico en formato AAAA-MM. `0` significa cero; `—` significa que todavía no se registró nota. Guardar conserva la nota como borrador pendiente de entrega.
5. **Informes:** seleccione Diseño Gráfico o Paquetes Sueltos, período y turno opcional. Consulte pendientes, marque **solo** las notas que va a incluir y cree la vista previa. Puede exportar borrador PDF/Excel para revisión; eso no presenta nada.
6. **Después de entregar a Dirección:** desde la vista previa o Historial abra el borrador, indique responsable y fecha real, marque «Confirmo que YA ENTREGUÉ» y pulse Confirmar entrega. Revise la confirmación final. Desde entonces solo esas notas dejan de aparecer como pendientes.
7. **Repita por la otra categoría.** No se mezclan cursos de Diseño Gráfico con Paquetes Sueltos. Los informes agrupan por turno y el PDF comienza cada turno en una página distinta. Cada categoría sin pendientes muestra un aviso y no genera un informe vacío.
8. **Historial:** busque por categoría, turno, estado o `2026-11`. Abra el informe y exporte sus copias PDF/XLSX. Los datos se conservan como estaban al cierre, aunque cambie el estudiante o catálogo. Los originales internos no deben modificarse manualmente.
9. **Rectificar:** seleccione la versión cerrada más reciente, elija la calificación, nueva nota y motivo. Indique responsable, fecha y confirme que la rectificación ya se entregó. Se crea una versión nueva; la original sigue disponible. Para corregir más notas, repita sobre la nueva versión.
10. **Respaldo:** en Configuración pulse Crear copia de seguridad y elija preferiblemente otro dispositivo. Para recuperar, seleccione un ZIP CEICOM válido y confirme el reemplazo. Se verifica integridad y se guarda un respaldo del estado anterior en `RespaldosPrevios`.

## Ejemplo de la regla principal

Juan (ejemplo ficticio) cursa Illustrator y Photoshop. Registre ambas notas de octubre. En noviembre prepare el informe con **solo Illustrator** y confirme su entrega después de presentarlo. En diciembre aparecerá pendiente Photoshop, aunque su nota ya estuviera guardada. Illustrator seguirá en Historial. La vista previa de diciembre no cambiará estos estados.

María (ejemplo ficticio) tiene una nota de Power BI guardada. Hasta confirmar la entrega de su informe de Paquetes Sueltos seguirá pendiente.

Una carta fechada el 4 de noviembre puede informar notas de octubre: el mes de nota y la fecha de entrega son campos independientes.

## Antes del primer uso real en Windows

Compile con `build_windows.bat`, extraiga el portable en una carpeta escribible, abra `SistemaAcademico.exe --demo` y complete el ejemplo. Verifique impresión/PDF, Excel, respaldo y restauración en una carpeta de prueba. Después abra el programa sin `--demo` para usar la base de producción vacía. Mantenga el programa y toda su carpeta `_internal` juntos.
