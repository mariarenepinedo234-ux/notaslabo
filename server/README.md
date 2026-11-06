# Servicios locales de CEICOM

`store.mjs` concentra las validaciones y operaciones transaccionales. Cada cierre conserva la instantánea original y modifica únicamente las calificaciones seleccionadas.

`app.mjs` expone la API y serializa escrituras, exportaciones y restauraciones. Las peticiones de la interfaz incluyen una cabecera personalizada y se rechazan orígenes ajenos al servidor local.

`exports.mjs` crea PDF/XLSX desde instantáneas y conserva los archivos ya archivados. `backup.mjs` crea y valida ZIP con SHA256 y SQLite antes de reemplazar los datos, conservando una copia previa.

`index.mjs` sirve la API y Vite con un único comando y puerto. La base se mantiene en el servidor local, fuera del almacenamiento del navegador.
