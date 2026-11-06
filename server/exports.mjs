import { fileURLToPath } from "node:url";
// Planilla carta: una fila por estudiante y una columna por cada curso de la categoría.
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { existsSync, writeFileSync } from "node:fs";
import { reportPath, exportReport as legacyExport } from "./exports-legacy.mjs";
import {
  isMatrixReport,
  reportMatrix,
  gradeCell,
} from "../shared/report-layout.js";
export { reportPath } from "./exports-legacy.mjs";
const wine = "#701C3A",
  ink = "#30303A";
export async function exportReport(store, id, format) {
  if (!["pdf", "xlsx"].includes(format)) throw new Error("Formato inválido.");
  const report = store.report(id),
    snapshot = report.contenido;
  store.assertDraftCurrent(report);
  // Reconstruir documentos antiguos con su diseño original, incluso si falta el archivo.
  if (!isMatrixReport(snapshot)) return legacyExport(store, id, format);
  const path = reportPath(store, report, format);
  if (existsSync(path)) return path;
  const matrix = reportMatrix(snapshot),
    cfg = snapshot.encabezado;
  const landscape = matrix.courses.length > 12;
  const title = `Planilla de notas · ${report.categoria}`;
  const reference = `Informe ${String(report.id).padStart(6, "0")} · v${report.version} · ${report.estado.toUpperCase()}`;
  const period = `Período del informe: ${report.periodo} | Entrega: ${snapshot.fecha_presentacion || "SIN CONFIRMAR"}`;
  const notes = [];
  matrix.students.forEach((student, index) =>
    matrix.courses.forEach((course) => {
      const rows = student.cells[course.key] || [];
      for (const [entry, row] of rows.entries()) {
        if (
          rows.length > 1 ||
          student.turnos.length > 1 ||
          row.observacion ||
          new Set(
            Object.values(student.cells)
              .flat()
              .map((r) => r.fecha_ingreso),
          ).size > 1 ||
          matrix.periods.length > 1
        )
          notes.push(
            `#${index + 1} · ${course.nombre}${rows.length > 1 ? ` (${entry + 1})` : ""} · ${row.turno} · Ingreso: ${row.fecha_ingreso} · Mes de nota: ${row.periodo}${row.observacion ? ` · ${row.observacion}` : ""}`,
          );
      }
    }),
  );
  const schedules = [
    ...new Set(
      snapshot.filas.map(
        (row) =>
          `${row.turno}: ${row.horario || cfg.horarios?.[row.turno] || "Sin horario registrado"}`,
      ),
    ),
  ];
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "CEICOM";
    wb.created = new Date(report.created_at);
    const ws = wb.addWorksheet("Calificaciones", {
      pageSetup: {
        paperSize: 1,
        orientation: landscape ? "landscape" : "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: "1:9",
        horizontalCentered: true,
        margins: {
          left: 0.35,
          right: 0.35,
          top: 0.35,
          bottom: 0.4,
          header: 0.15,
          footer: 0.2,
        },
      },
    });
    const count = matrix.courses.length + 3,
      last = ws.getColumn(count).letter;
    [
      cfg.institucion,
      title,
      reference,
      period,
      `Meses de las notas: ${matrix.periods.join(", ")}`,
      `Destinatario: ${cfg.destinatario || "________________"} · ${cfg.cargo_destinatario}`,
      `Horarios: ${schedules.join("; ")}`,
    ].forEach((text, i) => {
      ws.getCell(i + 1, 1).value = text;
      ws.mergeCells(i + 1, 1, i + 1, count);
      ws.getRow(i + 1).height = i === 6 ? 35 : 19;
      ws.getCell(i + 1, 1).alignment = { wrapText: true, vertical: "middle" };
    });
    ws.getRow(1).font = { bold: true, size: 17, color: { argb: "FF701C3A" } };
    ws.getCell(8, 1).value = "N°";
    ws.mergeCells(8, 1, 9, 1);
    ws.getCell(8, 2).value = "Estudiante";
    ws.mergeCells(8, 2, 9, 2);
    ws.getCell(8, 3).value =
      snapshot.formato === "matriz-estudiantes-v1"
        ? "Paquetes / cursos cursados y calificaciones"
        : "Paquetes / cursos de la categoría · Calificaciones";
    if (matrix.courses.length > 1) ws.mergeCells(8, 3, 8, count - 1);
    ws.getCell(8, count).value = "Turno / ingreso";
    ws.mergeCells(8, count, 9, count);
    matrix.courses.forEach((course, i) => {
      ws.getCell(9, i + 3).value = course.nombre;
      ws.getCell(9, i + 3).alignment = {
        textRotation: 90,
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
    });
    for (let row = 8; row <= 9; row++)
      for (let col = 1; col <= count; col++) {
        const cell = ws.getCell(row, col);
        cell.font = { bold: true, size: 9, color: { argb: "FF49303E" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF1D784" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCFBD8C" } },
          bottom: { style: "thin", color: { argb: "FFCFBD8C" } },
          left: { style: "thin", color: { argb: "FFCFBD8C" } },
          right: { style: "thin", color: { argb: "FFCFBD8C" } },
        };
      }
    ws.getRow(8).height = 25;
    ws.getRow(9).height = 110;
    ws.getColumn(1).width = 4.2;
    ws.getColumn(2).width = 25;
    ws.getColumn(count).width = 12.5;
    matrix.courses.forEach((_, i) => (ws.getColumn(i + 3).width = 4.6));
    matrix.students.forEach((student, i) => {
      const row = ws.addRow([
        i + 1,
        student.nombre,
        ...matrix.courses.map((course) => {
          const entries = student.cells[course.key] || [];
          return entries.length === 1 ? entries[0].valor : gradeCell(entries);
        }),
        student.turnos.join("\n") +
          "\nIngreso: " +
          [
            ...new Set(
              Object.values(student.cells)
                .flat()
                .map((r) => r.fecha_ingreso),
            ),
          ].join(", "),
      ]);
      row.height = Math.max(
        36,
        ...row.values.slice(1).map(
          (v, col) =>
            String(v)
              .split("\n")
              .reduce(
                (sum, line) =>
                  sum +
                  Math.max(
                    1,
                    Math.ceil(line.length / ws.getColumn(col + 1).width),
                  ),
                0,
              ) *
              14 +
            12,
        ),
      );
      row.eachCell((cell) => {
        cell.alignment = {
          vertical: "middle",
          horizontal: cell.col === 2 ? "left" : "center",
          wrapText: true,
        };
        cell.font = { size: 10 };
        cell.border = {
          bottom: { style: "thin", color: { argb: "FFE2DCE2" } },
        };
        if (i % 2 === 0)
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8F4F6" },
          };
      });
    });
    const legend = ws.addRow([
      "—: no se incluye una calificación de este curso en el informe.",
    ]);
    ws.mergeCells(legend.number, 1, legend.number, count);
    const end = ws.addRow([
      `Total: ${matrix.students.length} estudiantes · ${matrix.noteCount} calificaciones`,
    ]);
    ws.mergeCells(end.number, 1, end.number, count);
    const signature = ws.addRow([
      `${cfg.docente || "Docente: ____________________"} · ${cfg.cargo_docente || ""}`,
    ]);
    ws.mergeCells(signature.number, 1, signature.number, count);
    ws.addRow([cfg.firma || "Firma: ____________________"]);
    if (snapshot.rectificacion) {
      const row = ws.addRow([`Rectificación: ${snapshot.rectificacion}`]);
      ws.mergeCells(row.number, 1, row.number, count);
      row.height = 40;
      row.getCell(1).alignment = { wrapText: true };
    }
    if (notes.length) {
      const appendix = wb.addWorksheet("Detalle de inscripciones", {
        pageSetup: {
          paperSize: 1,
          orientation: "portrait",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          printTitlesRow: "1:2",
        },
      });
      appendix.getColumn(1).width = 100;
      appendix.getCell("A1").value =
        `${reference} · Detalle por número de estudiante`;
      appendix.getCell("A2").value =
        "Referencia # de la planilla; sin repetir nombres.";
      notes.forEach((n) => {
        const row = appendix.addRow([n]);
        row.getCell(1).alignment = { wrapText: true, vertical: "top" };
        row.height = Math.max(34, Math.ceil(n.length / 85) * 15);
      });
    }
    ws.views = [{ state: "frozen", xSplit: 2, ySplit: 9 }];
    ws.autoFilter = `A9:${last}${9 + matrix.students.length}`;
    ws.pageSetup.printArea = `A1:${last}${ws.rowCount}`;
    ws.headerFooter.oddFooter = `${reference} · Página &P de &N`;
    if (cfg.logo) {
      const image = wb.addImage({
        buffer: Buffer.from(cfg.logo.split(",")[1], "base64"),
        extension: cfg.logo.startsWith("data:image/png") ? "png" : "jpeg",
      });
      ws.addImage(image, {
        tl: { col: count - 1, row: 0 },
        ext: { width: 40, height: 35 },
      });
    }
    writeFileSync(path, Buffer.from(await wb.xlsx.writeBuffer()), {
      flag: "wx",
    });
    return path;
  }
  const doc = new PDFDocument({
    size: "LETTER",
    layout: landscape ? "landscape" : "portrait",
    margins: { top: 30, left: 30, right: 30, bottom: 40 },
    bufferPages: true,
    info: {
      Title: title,
      Author: cfg.docente || cfg.institucion,
      CreationDate: new Date(report.created_at),
    },
  });
  doc.registerFont(
    "CEICOM",
    fileURLToPath(
      new URL("../assets/fonts/LiberationSans-Regular.ttf", import.meta.url),
    ),
  );
  doc.registerFont(
    "CEICOM-Bold",
    fileURLToPath(
      new URL("../assets/fonts/LiberationSans-Bold.ttf", import.meta.url),
    ),
  );
  const buffers = [];
  doc.on("data", (b) => buffers.push(b));
  const done = new Promise((resolve, reject) => {
    doc.once("end", resolve);
    doc.once("error", reject);
  });
  const width = doc.page.width - 60,
    bottom = doc.page.height - 60;
  const gradeWidth = (width - 22 - 132 - 65) / matrix.courses.length;
  const widths = [22, 132, ...matrix.courses.map(() => gradeWidth), 65];
  let y = 30,
    page = 0;
  function line(text, size = 9, bold = false, color = ink) {
    doc
      .font(bold ? "CEICOM-Bold" : "CEICOM")
      .fontSize(size)
      .fillColor(color)
      .text(String(text), 30, y, { width });
    y = doc.y + 6;
  }
  function newPage() {
    if (page++) doc.addPage();
    y = 30;
  }
  function header(full) {
    newPage();
    if (full) {
      if (cfg.logo)
        doc.image(
          Buffer.from(cfg.logo.split(",")[1], "base64"),
          doc.page.width - 75,
          25,
          { fit: [42, 36] },
        );
      line(cfg.institucion, 18, true, wine);
      line(title, 13, true, wine);
      line(reference, 8);
      line(period, 9);
      line(`Meses de las notas: ${matrix.periods.join(", ")}`, 8);
      line(`Señor/a: ${cfg.destinatario || "________________________"}`, 9);
      line(cfg.cargo_destinatario, 9);
      line("Presente. —", 9);
      line(
        `De mi consideración: remito las calificaciones de los cursos individuales de ${report.categoria}, según la siguiente planilla.`,
        9,
      );
      line(`Horarios: ${schedules.join("; ")}`, 8);
    } else {
      line(
        `${cfg.institucion} · ${report.categoria} · continuación`,
        11,
        true,
        wine,
      );
      line(`${reference} | ${period}`, 8);
    }
    const headerHeight = 104;
    let x = 30;
    doc.font("CEICOM-Bold").fontSize(8);
    const headers = [
      "N°",
      "Estudiante",
      ...matrix.courses.map((c) => c.nombre),
      "Turno / ingreso",
    ];
    headers.forEach((text, i) => {
      doc
        .rect(x, y, widths[i], headerHeight)
        .fillAndStroke("#F1D784", "#D5C9A5");
      doc.fillColor("#49303E");
      if (i >= 2 && i < headers.length - 1) {
        const size = Math.min(8, (90 / doc.widthOfString(text)) * 8);
        doc
          .save()
          .translate(x + widths[i] / 2 - 3, y + headerHeight - 7)
          .rotate(-90)
          .fontSize(size)
          .text(text, 0, 0, { width: 90, lineBreak: false });
        doc.restore().fontSize(8);
      } else
        doc.text(text, x + 3, y + headerHeight / 2 - 4, {
          width: widths[i] - 6,
          align: i === 1 ? "left" : "center",
        });
      x += widths[i];
    });
    y += headerHeight;
  }
  header(true);
  matrix.students.forEach((student, index) => {
    const vals = [
      String(index + 1),
      student.nombre,
      ...matrix.courses.map((c) => gradeCell(student.cells[c.key])),
      student.turnos.join("\n") +
        "\n" +
        [
          ...new Set(
            Object.values(student.cells)
              .flat()
              .map((r) => r.fecha_ingreso),
          ),
        ].join("\n"),
    ];
    doc.font("CEICOM").fontSize(9);
    const height = Math.max(
      32,
      ...vals.map(
        (v, i) => doc.heightOfString(v, { width: widths[i] - 6 }) + 14,
      ),
    );
    if (y + height > bottom) header(false);
    let x = 30;
    vals.forEach((text, i) => {
      doc
        .rect(x, y, widths[i], height)
        .fillAndStroke(index % 2 ? "#FFFFFF" : "#F8F4F6", "#E3DEE3");
      const size =
        i === 1
          ? 9
          : Math.min(
              9,
              ((widths[i] - 6) /
                Math.max(
                  1,
                  ...text
                    .split("\n")
                    .map((t) => doc.fontSize(9).widthOfString(t)),
                )) *
                9,
            );
      doc
        .font("CEICOM")
        .fontSize(size)
        .fillColor(ink)
        .text(text, x + 3, y + 7, {
          width: widths[i] - 6,
          align: i === 1 ? "left" : "center",
        });
      x += widths[i];
    });
    y += height;
  });
  if (y + 30 > bottom) {
    newPage();
    line(reference, 8);
  }
  y += 8;
  line("—: no se incluye una calificación de este curso en el informe.", 7);
  line(
    `Total: ${matrix.students.length} estudiantes · ${matrix.noteCount} calificaciones`,
    9,
    true,
  );
  if (notes.length) {
    if (y + 45 > bottom) {
      newPage();
      line(reference, 8);
    }
    y += 8;
    line("Detalle por N° de estudiante", 10, true, wine);
    for (const note of notes) {
      doc.font("CEICOM").fontSize(8);
      const height = doc.heightOfString(note, { width }) + 10;
      if (y + height > bottom) {
        newPage();
        line(`${cfg.institucion} · Detalle (continuación)`, 11, true, wine);
        line(reference, 8);
      }
      line(note, 8);
    }
  }
  if (y + 90 > bottom) {
    newPage();
    line(reference, 8);
  }
  if (snapshot.rectificacion)
    line(`Rectificación: ${snapshot.rectificacion}`, 9);
  y += 15;
  line(cfg.firma || "________________________________", 10);
  line(cfg.docente || "Nombre del docente: ____________________", 10);
  line(cfg.cargo_docente || "", 9);
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc
      .font("CEICOM")
      .fontSize(7)
      .fillColor(wine)
      .text(reference, 30, doc.page.height - 29, { lineBreak: false });
    doc.text(
      `Página ${i + 1} de ${range.count} · Carta`,
      doc.page.width - 168,
      doc.page.height - 29,
      { lineBreak: false },
    );
  }
  doc.end();
  await done;
  writeFileSync(path, Buffer.concat(buffers), { flag: "wx" });
  return path;
}
