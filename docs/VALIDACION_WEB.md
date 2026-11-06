# Validación de CEICOM web

La petición del usuario sustituye Python/PySide6/PyInstaller por una aplicación web Node/React. La versión de escritorio se retiró del árbol actual; sus commits anteriores permanecen en el historial Git. No se encontraron datos reales de estudiantes en este checkout al sustituirla.

Verificaciones realizadas en Linux con Node 24:

- `npm install`: instalación reproducible con package-lock, sin Python ni compiladores nativos.
- `npm test`: 16 pruebas aprobadas, ninguna omitida. Incluyen entrega explícita, categorías, arrastre mensual, cero/sin nota, escala/fechas, reinscripciones, cierre obsoleto/duplicado, instantáneas protegidas, rectificaciones, exportación, respaldo/restauración y API.
- `npm run build`: compilación React/Vite correcta.
- `CEICOM_CHROMIUM=/usr/bin/chromium npm run test:e2e`: 2 pruebas aprobadas. Un flujo real registra alumno, dos inscripciones y notas, exporta Excel, confirma solo Illustrator y consulta Photoshop pendiente en diciembre e historial. La segunda verifica demostración aislada y móvil a 390 px sin desbordamiento.
- `npm audit --audit-level=low`: 0 vulnerabilidades conocidas al validar.
- Se generaron dos PDFs y dos XLSX de ejemplo con datos ficticios; se leyeron los Excel con ExcelJS y el contenido PDF con pdftotext. Se comprobó la separación por turno, el cero y la distinción octubre/fecha de entrega en noviembre.
- Se inspeccionó la interfaz renderizada en Chromium.

Se incluye CI en Windows y Linux para comprobar instalación, pruebas, compilación y navegador. Sus resultados remotos se verifican después de publicar el commit; no se presupone que han pasado.

La aplicación se ejecuta localmente. No se ha desplegado un sitio público ni se ha probado interacción manual en el equipo Windows del usuario.

## Planilla por estudiante en papel carta

Se añadieron pruebas de agrupación por ID (incluidos homónimos), reinscripciones, cero válido, doce columnas de cursos, lectura real del PDF con fuentes incorporadas, tamaño de página carta, nombres impresos una sola vez, configuración de impresión Excel y conservación del formato histórico anterior. La suite de Node pasa con 22 pruebas y el navegador con 3, incluido el botón que abre el PDF sin confirmar entrega. Se inspeccionó visualmente una planilla carta vertical de doce cursos y se incluyó una muestra explícitamente ficticia en ejemplos/.
