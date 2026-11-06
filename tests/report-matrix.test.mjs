import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import parsePdf from "pdf-parse/lib/pdf-parse.js";
import ExcelJS from "exceljs";
import { Store } from "../server/store.mjs";
import { exportReport } from "../server/exports.mjs";
import {
  reportMatrix,
  gradeCell,
  REPORT_FORMAT,
} from "../shared/report-layout.js";
function setup(t) {
  const s = new Store(mkdtempSync(join(tmpdir(), "ceicom-matrix-")));
  s.demo();
  t.after(() => {
    s.close();
    rmSync(s.root, { recursive: true, force: true });
  });
  return s;
}
function report(s) {
  const r = s.draft({
    categoria: "Diseño Gráfico",
    periodo: "2026-11",
    grade_ids: s.pending("Diseño Gráfico", "2026-11").map((r) => r.grade_id),
  });
  return s.confirm(r.id, {
    confirmed: true,
    responsable: "Docente ficticio",
    fecha_presentacion: "2026-11-04",
  });
}
async function pdfText(bytes) {
  return (await parsePdf(bytes)).text.replace(/\s/g, "");
}
test("Matriz: un estudiante en dos turnos aparece una vez, cero válido y solo cursos seleccionados", (t) => {
  const s = setup(t);
  const rows = s.pending("Diseño Gráfico", "2026-11");
  const snap = { filas: rows };
  const m = reportMatrix(snap);
  assert.equal(m.students.length, 1);
  assert.deepEqual(
    m.courses.map((c) => c.nombre),
    ["Illustrator", "Photoshop"],
  );
  assert.deepEqual(m.students[0].turnos.sort(), ["Mañana", "Tarde"]);
  assert.equal(gradeCell(m.students[0].cells[m.courses[1].key]), "0");
  assert.equal(
    reportMatrix({ filas: [rows.find((r) => r.curso === "Illustrator")] })
      .courses.length,
    1,
  );
  assert.equal(rows.length, 2);
});
test("Matriz no confunde estudiantes homónimos ni oculta reinscripciones deliberadas", (t) => {
  const s = setup(t);
  const first = s.enrollments().find((r) => r.curso === "Illustrator");
  const homonym = s.student({
    nombres: "Juan (FICTICIO)",
    apellidos: "Ejemplo",
  });
  const other = s.enroll({
    student_id: homonym.id,
    course_id: first.course_id,
    turno: "Noche",
    fecha_ingreso: "2026-10-01",
  });
  s.grade({ enrollment_id: other.id, valor: 74, periodo: "2026-10" });
  const reenroll = s.enroll({
    student_id: first.student_id,
    course_id: first.course_id,
    turno: "Noche",
    fecha_ingreso: "2026-10-15",
    deliberate: true,
  });
  s.grade({ enrollment_id: reenroll.id, valor: 91, periodo: "2026-10" });
  const m = reportMatrix({ filas: s.pending("Diseño Gráfico", "2026-11") });
  assert.equal(m.students.length, 2);
  const cell = m.students.find((r) => r.key === String(first.student_id)).cells[
    String(first.course_id)
  ];
  assert.equal(cell.length, 2);
  assert.match(gradeCell(cell), /85 \(1\)\n91 \(2\)/);
});
test("Excel: una fila por estudiante, cursos como columnas, notas numéricas y configuración carta", async (t) => {
  const s = setup(t),
    r = report(s);
  assert.equal(r.contenido.formato, REPORT_FORMAT);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(await exportReport(s, r.id, "xlsx"));
  const ws = book.worksheets[0];
  assert.equal(ws.getCell("C9").value, "Illustrator");
  assert.equal(ws.getCell("D9").value, "Photoshop");
  assert.equal(ws.getCell("B10").value, "Juan (FICTICIO) Ejemplo");
  assert.equal(ws.getCell("C10").value, 85);
  assert.equal(ws.getCell("D10").value, 0);
  let occurrences = 0;
  for (const sheet of book.worksheets)
    sheet.eachRow((row) =>
      row.eachCell((cell) => {
        if (cell.value === "Juan (FICTICIO) Ejemplo") occurrences++;
      }),
    );
  assert.equal(occurrences, 1);
  assert.equal(ws.pageSetup.paperSize, 1);
  assert.equal(ws.pageSetup.orientation, "portrait");
  assert.equal(ws.pageSetup.fitToWidth, 1);
  assert.equal(ws.pageSetup.printTitlesRow, "1:9");
});
test("PDF: carta vertical y nombre impreso una sola vez aun con cursos en distintos turnos", async (t) => {
  const s = setup(t),
    r = report(s);
  const bytes = readFileSync(await exportReport(s, r.id, "pdf"));
  assert.match(bytes.toString("latin1"), /\/MediaBox \[0 0 612 792\]/);
  const text = await pdfText(bytes);
  assert.equal(text.split("Juan(FICTICIO)Ejemplo").length - 1, 1);
  assert.ok(text.includes("Illustrator"));
  assert.ok(text.includes("Photoshop"));
  assert.ok(text.includes("2026-11-04"));
});
test("Doce cursos caben en carta vertical sin duplicar la persona ni perder notas", async (t) => {
  const s = setup(t);
  for (let c = 3; c <= 12; c++) {
    const e = s.enroll({
      student_id: 1,
      course_id: c,
      turno: "Mañana",
      fecha_ingreso: "2026-10-01",
    });
    s.grade({ enrollment_id: e.id, valor: 75 + c, periodo: "2026-10" });
  }
  const r = report(s),
    m = reportMatrix(r.contenido);
  assert.equal(m.courses.length, 12);
  assert.equal(m.students.length, 1);
  const bytes = readFileSync(await exportReport(s, r.id, "pdf"));
  assert.match(bytes.toString("latin1"), /\/MediaBox \[0 0 612 792\]/);
  assert.equal(
    (await pdfText(bytes)).split("Juan(FICTICIO)Ejemplo").length - 1,
    1,
  );
  const b = new ExcelJS.Workbook();
  await b.xlsx.readFile(await exportReport(s, r.id, "xlsx"));
  assert.equal(b.worksheets[0].getCell("N9").value, "Sony Vegas");
  assert.equal(b.worksheets[0].getCell("N10").value, 87);
});
test("Informes históricos anteriores conservan su diseño y archivos al reexportar o reconstruir", async (t) => {
  const s = setup(t);
  const rows = s.pending("Diseño Gráfico", "2026-11");
  const draft = s.draft({
    categoria: "Diseño Gráfico",
    periodo: "2026-11",
    grade_ids: rows.map((r) => r.grade_id),
  });
  const old = structuredClone(draft.contenido);
  delete old.formato;
  old.fecha_presentacion = "2026-11-04";
  s.run(
    "UPDATE reports SET snapshot=?,estado='presentado',confirmado_at=?,responsable=? WHERE id=?",
    JSON.stringify(old),
    "2026-11-04T12:00:00Z",
    "Docente ficticio",
    draft.id,
  );
  for (const row of rows)
    s.run("UPDATE grades SET report_id=? WHERE id=?", draft.id, row.grade_id);
  const pdf = await exportReport(s, draft.id, "pdf"),
    original = readFileSync(pdf);
  assert.match(original.toString("latin1"), /\/MediaBox \[0 0 792 612\]/);
  assert.deepEqual(
    readFileSync(await exportReport(s, draft.id, "pdf")),
    original,
  );
  const xlsx = await exportReport(s, draft.id, "xlsx");
  let b = new ExcelJS.Workbook();
  await b.xlsx.readFile(xlsx);
  assert.equal(
    b.worksheets[0].getCell("B9").value,
    b.worksheets[0].getCell("B10").value,
  );
  unlinkSync(xlsx);
  b = new ExcelJS.Workbook();
  await b.xlsx.readFile(await exportReport(s, draft.id, "xlsx"));
  assert.equal(
    b.worksheets[0].getCell("B9").value,
    b.worksheets[0].getCell("B10").value,
  );
  assert.equal(s.report(draft.id).snapshot, JSON.stringify(old));
});
