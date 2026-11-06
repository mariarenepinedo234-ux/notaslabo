// Modelo puro compartido por la vista previa y los documentos. No modifica notas.
export const REPORT_FORMAT = "matriz-catalogo-v2";
export const isMatrixReport = (snapshot) =>
  ["matriz-estudiantes-v1", REPORT_FORMAT].includes(snapshot.formato);
const order = [
  "Illustrator",
  "Photoshop",
  "InDesign",
  "QuarkXPress",
  "CorelDRAW",
  "3D Max",
  "Vectorworks",
  "AutoCAD",
  "AutoCAD Architectural",
  "Archicad",
  "Premiere",
  "Sony Vegas",
  "Python",
  "Java",
  "SolidWorks",
  "Revit",
  "Inteligencia Artificial",
  "Marketing Digital",
  "Power BI",
  "Filmora",
];
const courseKey = (row) => String(row.course_id ?? row.curso);
export function reportMatrix(snapshot) {
  const courses = new Map(),
    students = new Map();
  // El catálogo se archiva con el informe: no cambia al editar cursos después.
  if (snapshot.formato === REPORT_FORMAT && !Array.isArray(snapshot.catalogo))
    throw new Error("El informe no contiene su catálogo archivado.");
  for (const course of snapshot.catalogo || [])
    courses.set(String(course.id), {
      key: String(course.id),
      nombre: course.nombre,
    });
  for (const row of snapshot.filas) {
    const key = courseKey(row);
    courses.set(key, { key, nombre: row.curso });
    // Nunca agrupar por nombre: los homónimos son personas distintas.
    const studentKey = String(row.student_id ?? `inscripcion-${row.id}`);
    if (!students.has(studentKey))
      students.set(studentKey, {
        key: studentKey,
        nombre: row.estudiante,
        turnos: [],
        cells: {},
      });
    const student = students.get(studentKey);
    if (!student.turnos.includes(row.turno)) student.turnos.push(row.turno);
    (student.cells[key] ||= []).push(row);
  }
  for (const student of students.values())
    for (const entries of Object.values(student.cells))
      entries.sort((a, b) => a.id - b.id || a.grade_id - b.grade_id);
  const rank = (name) =>
    order.includes(name) ? order.indexOf(name) : order.length;
  return {
    courses: [...courses.values()].sort(
      (a, b) =>
        rank(a.nombre) - rank(b.nombre) ||
        a.nombre.localeCompare(b.nombre, "es"),
    ),
    students: [...students.values()].sort(
      (a, b) =>
        a.nombre.localeCompare(b.nombre, "es") || a.key.localeCompare(b.key),
    ),
    noteCount: snapshot.filas.length,
    periods: [...new Set(snapshot.filas.map((r) => r.periodo))].sort(),
  };
}
export function gradeCell(rows = []) {
  if (!rows.length) return "—";
  return rows
    .map(
      (row, index) => `${row.valor}${rows.length > 1 ? ` (${index + 1})` : ""}`,
    )
    .join("\n");
}
