# Guía breve · CEICOM web

1. Instale Node.js 24 LTS. Extraiga el ZIP y ejecute `npm.cmd install` y `npm.cmd run dev` en la carpeta de `package.json`.
2. Abra la dirección indicada en la terminal y manténgala abierta. El botón «Probar con datos ficticios» permite explorar sin alterar los datos reales.
3. En **Configuración**, complete destinatario, docente, cargos, firma, logo y escala. No se presuponen nombres oficiales. Configure horarios y catálogo.
4. En **Estudiantes**, pulse Nuevo estudiante. Nombres y apellidos son obligatorios; CI y teléfono opcionales. Puede buscar, editar y desactivar.
5. En **Inscripciones**, seleccione alumno y un curso individual. Repita para cada curso que realmente curse. Personalice turno, horario e ingreso. La reinscripción deliberada requiere marcar la opción explícita.
6. En **Calificaciones**, pulse Registrar nota. Indique valor y mes académico. Cero es válido; «—» significa sin nota. Guardar conserva la nota pendiente de entrega.
7. En **Informes**, elija una de las dos categorías, mes y turno opcional. Consulte pendientes, marque las notas incluidas y genere una vista previa. PDF y Excel se pueden revisar sin presentar nada.
8. **Después de entregar a Dirección**, indique responsable y fecha real, marque «YA ENTREGUÉ» y confirme el cierre. Solo esas notas dejan de salir como pendientes. Repita con la otra categoría si corresponde.
9. En **Historial**, filtre y abra cualquier informe. Descargue sus documentos o cree una rectificación con notas corregidas y motivo. Al confirmar que la rectificación fue entregada se crea una nueva versión; la anterior queda disponible.
10. En **Configuración**, descargue respaldos y guárdelos en otro dispositivo. Restaurar requiere un ZIP CEICOM web íntegro y confirmación; se conserva una copia del estado anterior.

## Ejemplo

Juan (ficticio) está inscrito a Illustrator y Photoshop. Si en noviembre confirma solo Illustrator, en diciembre seguirá pendiente Photoshop. María (ficticia) tiene Power BI guardado: seguirá pendiente hasta confirmar su entrega. Ninguna vista previa cambia esos estados.

Una nota de octubre puede entregarse el 4 de noviembre: el mes de la nota y la fecha de entrega son campos independientes.

## Si no abre

- Compruebe `node --version`: necesita Node 24 o posterior.
- Ejecute los comandos desde la carpeta que contiene `package.json`, fuera del ZIP.
- Si no abre automáticamente el navegador, escriba `http://127.0.0.1:3000`.
- Mantenga la terminal abierta. Si el puerto está ocupado, cierre la otra instancia.
- Comparta el texto que aparezca en la terminal si se produce un error.

## Planilla agrupada y lista para imprimir

En una nueva vista previa, cada estudiante aparece una sola vez y sus cursos son columnas con las notas respectivas. Use **Abrir PDF para imprimir** y, en el visor, seleccione papel **Carta** y escala **100 % / Tamaño real**. Hasta 12 cursos se imprimen en carta vertical, con encabezados de cursos verticales como la muestra; con más cursos se usa carta horizontal. La vista previa, PDF y Excel comparten la misma agrupación.

Los documentos históricos ya cerrados mantienen su diseño anterior. No se presenta ninguna nota por imprimir, descargar o cambiar el diseño. Al actualizar los archivos de la aplicación conserve las carpetas de datos e informes.
