import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import parsePdf from "pdf-parse/lib/pdf-parse.js";
import { Store, catalog } from "../server/store.mjs";
import { reportMatrix, gradeCell } from "../shared/report-layout.js";
import { exportReport } from "../server/exports.mjs";
function setup(t) {
  const s = new Store(mkdtempSync(join(tmpdir(), "ceicom-active-")));
  s.demo();
  t.after(() => {
    s.close();
    rmSync(s.root, { recursive: true, force: true });
  });
  return s;
}
function preview(s, category = "Diseño Gráfico", ids) {
  return s.draft({
    categoria: category,
    periodo: "2026-11",
    grade_ids: ids || s.pending(category, "2026-11").map((r) => r.grade_id),
  });
}
function confirm(s, r) {
  return s.confirm(r.id, {
    confirmed: true,
    responsable: "Docente ficticio",
    fecha_presentacion: "2026-11-04",
  });
}
test("Informes separados incluyen siempre los doce y ocho cursos, aun si solo se selecciona una nota", async (t) => {
  const s = setup(t);
  for (const [index, category] of [
    "Diseño Gráfico",
    "Paquetes Sueltos",
  ].entries()) {
    const note = s.pending(category, "2026-11")[0];
    const r = preview(s, category, [note.grade_id]);
    const m = reportMatrix(r.contenido);
    assert.deepEqual(
      m.courses.map((c) => c.nombre),
      catalog[index],
    );
    assert.equal(m.students.length, 1);
    assert.equal(m.noteCount, 1);
    for (const c of m.courses)
      assert.equal(
        gradeCell(m.students[0].cells[c.key]),
        c.nombre === note.curso ? String(note.valor) : "—",
      );
    const b = new ExcelJS.Workbook();
    await b.xlsx.readFile(await exportReport(s, r.id, "xlsx"));
    const ws = b.worksheets[0];
    assert.deepEqual(
      m.courses.map((_, i) => ws.getCell(9, i + 3).value),
      catalog[index],
    );
    const pdf = await parsePdf(
      readFileSync(await exportReport(s, r.id, "pdf")),
    );
    const text = pdf.text.replace(/\s/g, "");
    for (const name of catalog[index])
      assert.ok(text.includes(name.replace(/\s/g, "")));
    for (const name of catalog[1 - index])
      assert.ok(!text.includes(name.replace(/\s/g, "")));
    assert.match(
      readFileSync(await exportReport(s, r.id, "pdf")).toString("latin1"),
      /\/MediaBox \[0 0 612 792\]/,
    );
  }
});
test("El catálogo cerrado conserva sus columnas originales al editar, inactivar o agregar cursos", async (t) => {
  const s = setup(t),
    r = confirm(s, preview(s));
  const frozen = r.snapshot;
  s.course(
    { nombre: "Curso renombrado", categoria: "Diseño Gráfico", activo: 0 },
    2,
  );
  s.course({ nombre: "Curso nuevo", categoria: "Diseño Gráfico" });
  const current = s.report(r.id);
  assert.equal(current.snapshot, frozen);
  assert.deepEqual(
    reportMatrix(current.contenido).courses.map((c) => c.nombre),
    catalog[0],
  );
  const b = new ExcelJS.Workbook();
  await b.xlsx.readFile(await exportReport(s, r.id, "xlsx"));
  assert.equal(b.worksheets[0].getCell("D9").value, "Photoshop");
  assert.equal(b.worksheets[0].getCell("N9").value, "Sony Vegas");
});
test("Inactivar excluye todas las notas sin entregarlas; reactivar recupera pendientes en ambas categorías", (t) => {
  const s = setup(t);
  const student = s.student({ nombres: "Alex", apellidos: "Ficticio" });
  for (const c of [1, 13]) {
    const e = s.enroll({
      student_id: student.id,
      course_id: c,
      turno: "Noche",
      fecha_ingreso: "2026-10-01",
    });
    s.grade({ enrollment_id: e.id, valor: 0, periodo: "2026-10" });
  }
  const ids = s
    .enrollments()
    .filter((r) => r.student_id === student.id)
    .map((r) => r.grade_id);
  s.student({ active: 0 }, student.id);
  for (const category of ["Diseño Gráfico", "Paquetes Sueltos"])
    assert.ok(
      s.pending(category, "2026-12").every((r) => r.student_id !== student.id),
    );
  const history = s.studentHistory(student.id);
  assert.equal(history.student.active, 0);
  assert.equal(history.enrollments.length, 2);
  assert.ok(
    history.enrollments.every((r) => r.valor === 0 && r.report_id === null),
  );
  assert.throws(() => preview(s, "Diseño Gráfico", [ids[1]]));
  s.student({ active: 1 }, student.id);
  for (const category of ["Diseño Gráfico", "Paquetes Sueltos"])
    assert.equal(
      s.pending(category, "2026-12").filter((r) => r.student_id === student.id)
        .length,
      1,
    );
});
test("Inactivar después de la vista previa impide exportar o cerrar ese borrador obsoleto", async (t) => {
  const s = setup(t);
  const r = preview(s);
  await exportReport(s, r.id, "pdf");
  s.student({ active: 0 }, 1);
  assert.throws(() => confirm(s, r), /cambiaron/);
  await assert.rejects(() => exportReport(s, r.id, "pdf"), /cambiaron/);
  assert.equal(s.report(r.id).estado, "borrador");
  assert.ok(s.studentHistory(1).enrollments.every((r) => r.report_id === null));
  assert.equal(s.studentHistory(1).reports.length, 0);
});
test("Estudiante inactivo mantiene notas, informe cerrado, rectificaciones y archivos históricos intactos", async (t) => {
  const s = setup(t);
  const grade = s
    .pending("Diseño Gráfico", "2026-11")
    .find((r) => r.curso === "Illustrator");
  const old = confirm(s, preview(s, "Diseño Gráfico", [grade.grade_id]));
  const path = await exportReport(s, old.id, "pdf"),
    bytes = readFileSync(path);
  const corrected = s.rectify(old.id, {
    confirmed: true,
    responsable: "Docente ficticio",
    fecha_presentacion: "2026-12-04",
    motivo: "Corrección de prueba",
    corrections: { [grade.grade_id]: 96 },
  });
  s.student({ active: 0 }, 1);
  const h = s.studentHistory(1);
  assert.equal(h.enrollments.length, 2);
  assert.deepEqual(
    h.reports.map((r) => r.id),
    [corrected.id, old.id],
  );
  assert.equal(s.report(old.id).snapshot, old.snapshot);
  assert.deepEqual(readFileSync(await exportReport(s, old.id, "pdf")), bytes);
  s.student({ active: 1 }, 1);
  assert.deepEqual(
    s
      .pending("Diseño Gráfico", "2027-01")
      .filter((r) => r.student_id === 1)
      .map((r) => r.curso),
    ["Photoshop"],
  );
});
test("Los informes matriz anteriores siguen mostrando solo sus columnas archivadas", (t) => {
  const snapshot = {
    formato: "matriz-estudiantes-v1",
    filas: [
      {
        id: 1,
        student_id: 1,
        course_id: 1,
        estudiante: "Ejemplo",
        curso: "Illustrator",
        turno: "Mañana",
        valor: 80,
        periodo: "2026-10",
      },
    ],
  };
  assert.equal(reportMatrix(snapshot).courses.length, 1);
});

test("Reconstruir una matriz histórica v1 conserva sus columnas parciales y encabezado anterior", async (t) => {
  const s = setup(t);
  const draft = preview(s);
  const original = structuredClone(draft.contenido);
  original.formato = "matriz-estudiantes-v1";
  delete original.catalogo;
  original.fecha_presentacion = "2026-11-04";
  s.run(
    "UPDATE reports SET snapshot=?,estado='presentado',confirmado_at=?,responsable=? WHERE id=?",
    JSON.stringify(original),
    "2026-11-04T12:00:00Z",
    "Docente ficticio",
    draft.id,
  );
  for (const row of original.filas)
    s.run("UPDATE grades SET report_id=? WHERE id=?", draft.id, row.grade_id);
  const b = new ExcelJS.Workbook();
  await b.xlsx.readFile(await exportReport(s, draft.id, "xlsx"));
  const ws = b.worksheets[0];
  assert.equal(
    ws.getCell("C8").value,
    "Paquetes / cursos cursados y calificaciones",
  );
  assert.equal(ws.getCell("C9").value, "Illustrator");
  assert.equal(ws.getCell("D9").value, "Photoshop");
  assert.equal(ws.columnCount, 5);
  const pdf = await parsePdf(
    readFileSync(await exportReport(s, draft.id, "pdf")),
  );
  assert.ok(!pdf.text.includes("Sony Vegas"));
  assert.equal(s.report(draft.id).snapshot, JSON.stringify(original));
});
