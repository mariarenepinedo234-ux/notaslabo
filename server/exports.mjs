// Los documentos se generan únicamente desde la instantánea archivada.
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
const headers = [
  "N°",
  "Estudiante",
  "Ingreso",
  "Curso individual",
  "Nota",
  "Mes de nota",
  "Turno",
  "Observaciones",
];
const burgundy = "#701C3A";
const values = (r, i) => [
  i + 1,
  r.estudiante,
  r.fecha_ingreso,
  r.curso,
  r.valor,
  r.periodo,
  r.turno,
  r.observacion,
];
export function reportPath(store, r, extension) {
  const folder = join(
    store.root,
    "Informes",
    r.periodo.slice(0, 4),
    r.periodo.slice(5),
  );
  mkdirSync(folder, { recursive: true });
  return join(
    folder,
    `CEICOM_${r.categoria === "Diseño Gráfico" ? "DG" : "PS"}_${r.periodo}_I${String(r.id).padStart(6, "0")}_v${r.version}${r.estado === "borrador" ? "_BORRADOR" : ""}.${extension}`,
  );
}
export async function exportReport(store, id, format) {
  if (!["pdf", "xlsx"].includes(format)) throw new Error("Formato inválido.");
  const r = store.report(id);
  const path = reportPath(store, r, format);
  if (existsSync(path)) return path;
  const s = r.contenido,
    c = s.encabezado;
  const rows = [...s.filas].sort(
    (a, b) =>
      a.turno.localeCompare(b.turno) ||
      a.curso.localeCompare(b.curso) ||
      a.estudiante.localeCompare(b.estudiante),
  );
  const reference = `Informe ${String(r.id).padStart(6, "0")} · v${r.version} · ${r.estado.toUpperCase()}`;
  const title = `Planilla de notas · ${r.categoria}`;
  const period = `Mes académico: ${r.periodo} | Fecha de entrega: ${s.fecha_presentacion || "SIN CONFIRMAR"}`;
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "CEICOM";
    wb.created = new Date(r.created_at);
    const ws = wb.addWorksheet("Calificaciones", {
      pageSetup: {
        paperSize: 1,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: "1:8",
      },
    });
    [
      c.institucion,
      title,
      reference,
      period,
      `Destinatario: ${c.destinatario || "________________"} · ${c.cargo_destinatario}`,
      `Docente: ${c.docente || "________________"} · ${c.cargo_docente}`,
    ].forEach((value, i) => {
      ws.getCell(i + 1, 1).value = value;
      ws.mergeCells(i + 1, 1, i + 1, 8);
    });
    ws.getRow(8).values = headers;
    ws.getRow(8).height = 25;
    headers.forEach((_, i) => {
      const cell = ws.getCell(8, i + 1);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF701C3A" },
      };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    });
    rows.forEach((row, i) => {
      const v = ws.addRow(values(row, i));
      v.height = 34;
      v.eachCell((cell) => {
        cell.alignment = { vertical: "top", wrapText: true };
        if (i % 2 === 0)
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF5F1F3" },
          };
      });
      if (i && rows[i - 1].turno !== row.turno)
        ws.getRow(v.number - 1).addPageBreak();
    });
    ws.addRow([`Total de calificaciones: ${rows.length}`]);
    if (s.rectificacion) ws.addRow([`Rectificación: ${s.rectificacion}`]);
    ws.addRow([c.firma || "Firma: ____________________"]);
    [7, 34, 16, 27, 9, 17, 16, 48].forEach(
      (width, i) => (ws.getColumn(i + 1).width = width),
    );
    ws.views = [{ state: "frozen", ySplit: 8 }];
    ws.autoFilter = `A8:H${8 + rows.length}`;
    ws.headerFooter.oddFooter = "Página &P de &N";
    if (c.logo) {
      const image = wb.addImage({
        buffer: Buffer.from(c.logo.split(",")[1], "base64"),
        extension: c.logo.startsWith("data:image/png") ? "png" : "jpeg",
      });
      ws.addImage(image, {
        tl: { col: 7, row: 0 },
        ext: { width: 55, height: 40 },
      });
    }
    writeFileSync(path, Buffer.from(await wb.xlsx.writeBuffer()), {
      flag: "wx",
    });
    return path;
  }
  const doc = new PDFDocument({
    size: "LETTER",
    layout: "landscape",
    margin: 30,
    bufferPages: true,
    info: {
      Title: title,
      Author: c.docente || c.institucion,
      CreationDate: new Date(r.created_at),
    },
  });
  const chunks = [];
  doc.on("data", (b) => chunks.push(b));
  const done = new Promise((resolve, reject) => {
    doc.on("end", resolve);
    doc.on("error", reject);
  });
  const widths = [24, 155, 68, 125, 38, 65, 75, 182];
  let y = 30,
    page = 0,
    currentShift = "";
  const simple = (str, size = 10, color = "#343843") => {
    doc
      .font("Helvetica")
      .fontSize(size)
      .fillColor(color)
      .text(String(str), 30, y, { width: 732 });
    y = doc.y + 7;
  };
  const heading = (shift, full) => {
    if (page) doc.addPage();
    page++;
    y = 30;
    if (full) {
      if (c.logo)
        doc.image(Buffer.from(c.logo.split(",")[1], "base64"), 702, 25, {
          fit: [50, 40],
        });
      simple(c.institucion, 22, burgundy);
      simple(title, 15, burgundy);
      simple(reference, 9);
      simple(period, 10);
      y += 3;
      simple(`Señor/a: ${c.destinatario || "________________________"}`, 10);
      simple(c.cargo_destinatario, 9);
      simple("Presente. —", 9);
      simple(
        `Mediante el presente informe se remiten las calificaciones de ${r.categoria}. Cada fila indica su mes académico.`,
        10,
      );
    } else {
      simple(`${c.institucion} · ${r.categoria} · continuación`, 12, burgundy);
      simple(`${reference} | ${period}`, 9);
    }
    simple(`Turno / grupo: ${shift}`, 10, burgundy);
    if (full) {
      const schedules = [
        ...new Set(
          rows
            .filter((row) => row.turno === shift)
            .map((row) => row.horario || c.horarios?.[shift] || ""),
        ),
      ];
      simple(`Horario: ${schedules.join("; ")}`, 9);
    }
    let x = 30;
    doc.rect(30, y, 732, 25).fill("#F1D784");
    headers.forEach((h, i) => {
      doc
        .fillColor("#3D3035")
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(h, x + 4, y + 8, { width: widths[i] - 8, lineBreak: false });
      x += widths[i];
    });
    y += 25;
  };
  rows.forEach((row, i) => {
    if (row.turno !== currentShift) {
      currentShift = row.turno;
      heading(currentShift, true);
    }
    const v = values(row, i).map(String);
    doc.font("Helvetica").fontSize(9);
    const height = Math.max(
      32,
      ...v.map(
        (str, col) => doc.heightOfString(str, { width: widths[col] - 8 }) + 15,
      ),
    );
    if (y + height > 545) heading(currentShift, false);
    let x = 30;
    doc.rect(30, y, 732, height).fill(i % 2 ? "#FFFFFF" : "#F6F2F4");
    v.forEach((str, col) => {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#30303A")
        .text(str, x + 4, y + 7, { width: widths[col] - 8 });
      x += widths[col];
    });
    y += height;
  });
  if (y > 470) {
    heading(currentShift, false);
  }
  y += 12;
  simple(`Total de calificaciones: ${rows.length}`, 10);
  if (s.rectificacion) simple(`Rectificación: ${s.rectificacion}`, 9);
  y += 12;
  simple(c.firma || "________________________________", 10);
  simple(c.docente || "Nombre del docente: ____________________", 10);
  simple(c.cargo_docente || "", 9);
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .fillColor(burgundy)
      .text(reference, 30, 575, { lineBreak: false });
    doc.text(`Página ${i + 1} de ${range.count}`, 650, 575, {
      lineBreak: false,
    });
  }
  doc.end();
  await done;
  writeFileSync(path, Buffer.concat(chunks), { flag: "wx" });
  return path;
}
