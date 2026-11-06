import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { Store, categories } from "../server/store.mjs";
import { exportReport } from "../server/exports.mjs";
import {
  createBackup,
  validateBackup,
  restoreBackup,
} from "../server/backup.mjs";
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "ceicom-test-"));
  const s = new Store(root);
  t.after(() => {
    s.close();
    rmSync(root, { recursive: true, force: true });
  });
  s.demo();
  const ids = Object.fromEntries(
    s.enrollments().map((r) => [r.curso, r.grade_id]),
  );
  return { s, ids, root };
}
function deliver(s, ids, category = categories[0]) {
  const r = s.draft({
    categoria: category,
    periodo: "2026-11",
    grade_ids: ids,
  });
  return s.confirm(r.id, {
    confirmed: true,
    responsable: "Docente ficticio",
    fecha_presentacion: "2026-11-04",
  });
}
test("Catálogo exacto, idempotente y modo ficticio", (t) => {
  const { s } = fixture(t);
  assert.equal(s.all("SELECT * FROM courses").length, 20);
  assert.equal(
    s.all("SELECT * FROM courses WHERE categoria=?", categories[0]).length,
    12,
  );
  s.demo();
  assert.equal(s.state().students.length, 2);
});
test("Vista previa y exportar no presentan; la entrega exige confirmación literal", async (t) => {
  const { s, ids } = fixture(t);
  const r = s.draft({
    categoria: categories[0],
    periodo: "2026-11",
    grade_ids: [ids.Illustrator],
  });
  await exportReport(s, r.id, "pdf");
  assert.equal(s.pending(categories[0], "2026-12").length, 2);
  assert.throws(
    () =>
      s.confirm(r.id, {
        confirmed: "true",
        responsable: "Docente",
        fecha_presentacion: "2026-11-04",
      }),
    /confirmar/,
  );
  assert.equal(s.report(r.id).estado, "borrador");
});
test("Illustrator presentado no oculta Photoshop; Power BI registrado sigue pendiente", (t) => {
  const { s, ids } = fixture(t);
  const r = deliver(s, [ids.Illustrator]);
  assert.deepEqual(
    s.pending(categories[0], "2026-12").map((r) => r.curso),
    ["Photoshop"],
  );
  assert.equal(s.pending(categories[1], "2026-12")[0].curso, "Power BI");
  assert.equal(r.contenido.filas[0].periodo, "2026-10");
  assert.equal(r.contenido.fecha_presentacion, "2026-11-04");
});
test("Categorías separadas, notas futuras y sin nota excluidas; vacío rechazado", (t) => {
  const { s, ids } = fixture(t);
  assert.equal(s.pending(categories[0], "2026-09").length, 0);
  for (const grade_ids of [
    [],
    [ids["Power BI"]],
    [ids.Illustrator, ids["Power BI"]],
  ])
    assert.throws(() =>
      s.draft({ categoria: categories[0], periodo: "2026-11", grade_ids }),
    );
  const e = s.enroll({
    student_id: 1,
    course_id: 3,
    fecha_ingreso: "2026-10-01",
    turno: "Mañana",
  });
  assert.equal(s.enrollments().find((r) => r.id === e.id).valor, null);
  assert.equal(s.pending(categories[0], "2026-11").length, 2);
});
test("Cero es válido; vacío, null, NaN, infinitos, fuera de escala y fechas inválidas no", (t) => {
  const { s } = fixture(t);
  const row = s.enrollments().find((r) => r.curso === "Photoshop");
  assert.equal(row.valor, 0);
  for (const valor of ["", null, true, -1, 101, NaN, Infinity])
    assert.throws(() =>
      s.grade({ enrollment_id: row.id, valor, periodo: "2026-10" }),
    );
  assert.throws(() =>
    s.grade({ enrollment_id: row.id, valor: 12, periodo: "2026-13" }),
  );
  assert.throws(() =>
    s.enroll({
      student_id: 1,
      course_id: 4,
      fecha_ingreso: "2026-02-30",
      turno: "Tarde",
    }),
  );
});
test("Duplicación accidental impedida; reinscripción deliberada permitida", (t) => {
  const { s } = fixture(t);
  const row = s.enrollments().find((r) => r.curso === "Illustrator");
  const v = {
    student_id: row.student_id,
    course_id: row.course_id,
    turno: "Noche",
    fecha_ingreso: "2026-11-01",
  };
  assert.throws(() => s.enroll(v), /Ya existe/);
  assert.ok(s.enroll({ ...v, deliberate: true }).id);
});
test("Cierre obsoleto y duplicado se rechazan sin afectar las otras notas", (t) => {
  const { s, ids } = fixture(t);
  const a = s.draft({
    categoria: categories[0],
    periodo: "2026-11",
    grade_ids: [ids.Illustrator],
  });
  const b = s.draft({
    categoria: categories[0],
    periodo: "2026-11",
    grade_ids: [ids.Illustrator, ids.Photoshop],
  });
  s.confirm(a.id, {
    confirmed: true,
    responsable: "Docente",
    fecha_presentacion: "2026-11-04",
  });
  assert.throws(
    () =>
      s.confirm(b.id, {
        confirmed: true,
        responsable: "Docente",
        fecha_presentacion: "2026-11-04",
      }),
    /cambiaron/,
  );
  assert.equal(s.report(b.id).estado, "borrador");
  assert.equal(s.pending(categories[0], "2026-12").length, 1);
  assert.throws(
    () =>
      s.confirm(a.id, {
        confirmed: true,
        responsable: "Docente",
        fecha_presentacion: "2026-11-04",
      }),
    /cerrado/,
  );
});
test("Cambiar el nombre después de la vista previa exige un nuevo borrador", (t) => {
  const { s, ids } = fixture(t);
  const r = s.draft({
    categoria: categories[0],
    periodo: "2026-11",
    grade_ids: [ids.Illustrator],
  });
  s.student({ nombres: "Juan cambiado" }, 1);
  assert.throws(
    () =>
      s.confirm(r.id, {
        confirmed: true,
        responsable: "Docente",
        fecha_presentacion: "2026-11-04",
      }),
    /cambiaron/,
  );
  assert.equal(s.pending(categories[0], "2026-12").length, 2);
});
test("Historial protegido incluso ante cambios de alumnos, notas e items SQL", async (t) => {
  const { s, ids } = fixture(t);
  const r = deliver(s, [ids.Illustrator]);
  const pdf = await exportReport(s, r.id, "pdf");
  const bytes = readFileSync(pdf);
  s.student({ nombres: "Otro nombre" }, 1);
  assert.equal(s.report(r.id).snapshot, r.snapshot);
  assert.throws(
    () => s.run("UPDATE reports SET snapshot=? WHERE id=?", "{}", r.id),
    /inmutable/,
  );
  assert.throws(
    () => s.run("DELETE FROM report_items WHERE report_id=?", r.id),
    /protegido/,
  );
  assert.throws(
    () =>
      s.grade({
        enrollment_id: r.contenido.filas[0].id,
        valor: 90,
        periodo: "2026-10",
      }),
    /presentada/,
  );
  assert.deepEqual(readFileSync(await exportReport(s, r.id, "pdf")), bytes);
});
test("Rectificación crea versión nueva y no reabre pendientes; original inmutable", (t) => {
  const { s, ids } = fixture(t);
  const old = deliver(s, [ids.Illustrator]);
  const v = {
    corrections: { [ids.Illustrator]: 94 },
    motivo: "Corrección documentada",
    responsable: "Docente",
    fecha_presentacion: "2027-01-05",
    confirmed: true,
  };
  const next = s.rectify(old.id, v);
  assert.equal(next.version, 2);
  assert.equal(next.parent_id, old.id);
  assert.equal(next.contenido.filas[0].valor, 94);
  assert.equal(s.report(old.id).snapshot, old.snapshot);
  assert.equal(s.pending(categories[0], "2027-01").length, 1);
  assert.throws(() => s.rectify(old.id, v), /reciente/);
  assert.throws(() => s.rectify(next.id, { ...v, corrections: { 999: 88 } }));
});
test("PDF y Excel contienen datos y se regeneran desde el archivo histórico", async (t) => {
  const { s, ids } = fixture(t);
  const r = deliver(s, [ids["Power BI"]], categories[1]);
  const pdf = await exportReport(s, r.id, "pdf");
  assert.equal(readFileSync(pdf).subarray(0, 5).toString(), "%PDF-");
  const xlsx = await exportReport(s, r.id, "xlsx");
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(xlsx);
  assert.equal(book.worksheets[0].getCell("C9").value, "Power BI");
  assert.equal(book.worksheets[0].getCell("C10").value, 92);
  assert.match(book.worksheets[0].getCell("A4").value, /2026-11-04/);
  unlinkSync(pdf);
  assert.ok(existsSync(await exportReport(s, r.id, "pdf")));
});
test("XLSX trata nombres con = como texto", async (t) => {
  const { s, ids } = fixture(t);
  s.student({ nombres: '=HYPERLINK("x")' }, 1);
  const r = deliver(s, [ids.Illustrator]);
  const b = new ExcelJS.Workbook();
  await b.xlsx.readFile(await exportReport(s, r.id, "xlsx"));
  assert.equal(typeof b.worksheets[0].getCell("B10").value, "string");
});
test("PDF pagina y separa turnos con 70 notas y observaciones largas", async (t) => {
  const { s, ids } = fixture(t);
  const selected = [ids.Illustrator];
  for (let i = 0; i < 70; i++) {
    const student = s.student({
      nombres: `Ficticio ${i}`,
      apellidos: "Prueba",
    });
    const e = s.enroll({
      student_id: student.id,
      course_id: 1,
      turno: i % 2 ? "Tarde" : "Noche",
      fecha_ingreso: "2026-10-01",
    });
    selected.push(
      s.grade({
        enrollment_id: e.id,
        valor: 75,
        periodo: "2026-10",
        observacion: "Observación de prueba. ".repeat(10),
      }).id,
    );
  }
  const r = deliver(s, selected);
  const bytes = readFileSync(await exportReport(s, r.id, "pdf"));
  assert.ok(
    (bytes.toString("latin1").match(/\/Type \/Page\b/g) || []).length > 3,
  );
});
test("Respaldo restaurable, comprobación SHA256 y copia previa", async (t) => {
  const { s, ids, root } = fixture(t);
  const r = deliver(s, [ids.Illustrator]);
  const path = await exportReport(s, r.id, "pdf");
  const original = readFileSync(path);
  const buffer = await createBackup(s);
  await validateBackup(buffer);
  s.student({ nombres: "Después", apellidos: "del respaldo" });
  await assert.rejects(() => restoreBackup(s, buffer, false), /Confirme/);
  const result = await restoreBackup(s, buffer, true);
  assert.ok(existsSync(join(root, result.recovery)));
  assert.equal(s.state().students.length, 2);
  assert.deepEqual(readFileSync(await exportReport(s, r.id, "pdf")), original);
  const bad = await JSZip.loadAsync(buffer);
  bad.file("datos/academico.sqlite", Buffer.from("alterado"));
  const corrupted = await bad.generateAsync({ type: "nodebuffer" });
  await assert.rejects(() => restoreBackup(s, corrupted, true), /alterado/);
});
