import { REPORT_FORMAT } from "../shared/report-layout.js";
// SQLite integrado en Node 24: no requiere Python ni módulos nativos externos.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

export const categories = ["Diseño Gráfico", "Paquetes Sueltos"];
export const catalog = [
  [
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
  ],
  [
    "Python",
    "Java",
    "SolidWorks",
    "Revit",
    "Inteligencia Artificial",
    "Marketing Digital",
    "Power BI",
    "Filmora",
  ],
];
export const defaults = {
  institucion: "CEICOM",
  destinatario: "",
  cargo_destinatario: "Directora Académica",
  docente: "",
  cargo_docente: "",
  firma: "",
  logo: "",
  minimo: 0,
  maximo: 100,
  horarios: {
    Mañana: "Lunes, miércoles y viernes · 08:00–12:00",
    Tarde: "Lunes, miércoles y viernes · 15:00–18:00",
    Noche: "Lunes, miércoles y viernes · 18:00–21:00",
  },
};
export const now = () => new Date().toISOString();
const required = (v, label) => {
  if (typeof v !== "string" || !v.trim() || v.length > 120)
    throw new Error(`Complete ${label}.`);
  return v.trim();
};
export function period(v) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(v) || +v.slice(0, 4) < 1900)
    throw new Error("Mes inválido. Use AAAA-MM.");
  return v;
}
export function date(v) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    Number.isNaN(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    throw new Error("Fecha inválida.");
  return v;
}
const safeText = (v) => (typeof v === "string" ? v.trim() : "");
export class Store {
  constructor(root) {
    this.root = resolve(root);
    this.path = join(this.root, "datos", "academico.sqlite");
    mkdirSync(join(this.root, "datos"), { recursive: true });
    mkdirSync(join(this.root, "Informes"), { recursive: true });
    this.open();
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS students(id INTEGER PRIMARY KEY,nombres TEXT NOT NULL,apellidos TEXT NOT NULL,ci TEXT NOT NULL DEFAULT '',telefono TEXT NOT NULL DEFAULT '',observaciones TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS courses(id INTEGER PRIMARY KEY,nombre TEXT UNIQUE NOT NULL,categoria TEXT NOT NULL CHECK(categoria IN('Diseño Gráfico','Paquetes Sueltos')),activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN(0,1)));
      CREATE TABLE IF NOT EXISTS enrollments(id INTEGER PRIMARY KEY,student_id INTEGER NOT NULL REFERENCES students(id),course_id INTEGER NOT NULL REFERENCES courses(id),turno TEXT NOT NULL,horario TEXT NOT NULL,fecha_ingreso TEXT NOT NULL,fecha_fin TEXT,estado TEXT NOT NULL CHECK(estado IN('activo','concluido','retirado')));
      CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY,categoria TEXT NOT NULL,periodo TEXT NOT NULL,turno TEXT NOT NULL,estado TEXT NOT NULL CHECK(estado IN('borrador','presentado','rectificado')),version INTEGER NOT NULL DEFAULT 1,parent_id INTEGER REFERENCES reports(id),snapshot TEXT NOT NULL,created_at TEXT NOT NULL,confirmado_at TEXT,responsable TEXT,motivo TEXT);
      CREATE TABLE IF NOT EXISTS grades(id INTEGER PRIMARY KEY,enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),tipo TEXT NOT NULL DEFAULT 'final',valor REAL NOT NULL,periodo TEXT NOT NULL,observacion TEXT NOT NULL,report_id INTEGER REFERENCES reports(id),updated_at TEXT NOT NULL,UNIQUE(enrollment_id,tipo));
      CREATE TABLE IF NOT EXISTS report_items(report_id INTEGER NOT NULL REFERENCES reports(id),grade_id INTEGER NOT NULL REFERENCES grades(id),PRIMARY KEY(report_id,grade_id));
      CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY,entidad TEXT NOT NULL,entidad_id INTEGER,accion TEXT NOT NULL,antes_json TEXT,despues_json TEXT,fecha TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS grade_pending ON grades(report_id,periodo);
      CREATE INDEX IF NOT EXISTS report_period ON reports(categoria,periodo,turno);
      CREATE TRIGGER IF NOT EXISTS frozen_report BEFORE UPDATE ON reports WHEN OLD.estado!='borrador' BEGIN SELECT RAISE(ABORT,'Informe histórico inmutable'); END;
      CREATE TRIGGER IF NOT EXISTS frozen_report_delete BEFORE DELETE ON reports WHEN OLD.estado!='borrador' BEGIN SELECT RAISE(ABORT,'Informe histórico protegido'); END;
      CREATE TRIGGER IF NOT EXISTS frozen_grade BEFORE UPDATE ON grades WHEN OLD.report_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'Use rectificación desde Historial'); END;
      CREATE TRIGGER IF NOT EXISTS frozen_grade_delete BEFORE DELETE ON grades WHEN OLD.report_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'Nota presentada protegida'); END;
      CREATE TRIGGER IF NOT EXISTS frozen_items BEFORE DELETE ON report_items WHEN (SELECT estado FROM reports WHERE id=OLD.report_id)!='borrador' BEGIN SELECT RAISE(ABORT,'Informe histórico protegido'); END;
      CREATE TRIGGER IF NOT EXISTS frozen_items_update BEFORE UPDATE ON report_items WHEN (SELECT estado FROM reports WHERE id=OLD.report_id)!='borrador' BEGIN SELECT RAISE(ABORT,'Informe histórico protegido'); END;
      CREATE TRIGGER IF NOT EXISTS frozen_items_insert BEFORE INSERT ON report_items WHEN (SELECT estado FROM reports WHERE id=NEW.report_id)!='borrador' BEGIN SELECT RAISE(ABORT,'Informe histórico protegido'); END;
    `);
    this.tx(() => {
      this.run(
        "INSERT OR IGNORE INTO settings VALUES(1,?)",
        JSON.stringify(defaults),
      );
      if (!this.get("SELECT id FROM courses LIMIT 1"))
        catalog.forEach((names, i) =>
          names.forEach((n) =>
            this.run(
              "INSERT INTO courses(nombre,categoria) VALUES(?,?)",
              n,
              categories[i],
            ),
          ),
        );
    });
  }
  open() {
    this.db = new DatabaseSync(this.path);
    this.db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  }
  close() {
    this.db.close();
  }
  run(sql, ...params) {
    return this.db.prepare(sql).run(...params);
  }
  get(sql, ...params) {
    return this.db.prepare(sql).get(...params);
  }
  all(sql, ...params) {
    return this.db.prepare(sql).all(...params);
  }
  tx(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  audit(entity, id, action, before, after) {
    this.run(
      "INSERT INTO audit_log(entidad,entidad_id,accion,antes_json,despues_json,fecha) VALUES(?,?,?,?,?,?)",
      entity,
      id,
      action,
      JSON.stringify(before ?? null),
      JSON.stringify(after ?? null),
      now(),
    );
  }
  settings() {
    return JSON.parse(this.get("SELECT value FROM settings WHERE id=1").value);
  }
  saveSettings(input) {
    const cfg = { ...this.settings(), ...input };
    required(cfg.institucion, "la institución");
    if (
      !Number.isFinite(+cfg.minimo) ||
      !Number.isFinite(+cfg.maximo) ||
      +cfg.minimo >= +cfg.maximo
    )
      throw new Error("Escala inválida.");
    if (
      !cfg.horarios ||
      typeof cfg.horarios !== "object" ||
      Array.isArray(cfg.horarios) ||
      !Object.keys(cfg.horarios).length ||
      Object.entries(cfg.horarios).some(
        ([k, v]) => !k.trim() || typeof v !== "string" || !v.trim(),
      )
    )
      throw new Error("Configure al menos un turno y horario.");
    if (
      cfg.logo &&
      (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(cfg.logo) ||
        cfg.logo.length > 1400000)
    )
      throw new Error("El logo debe ser PNG/JPG de hasta 1 MB.");
    this.tx(() => {
      this.audit("settings", 1, "editar", this.settings(), cfg);
      this.run("UPDATE settings SET value=? WHERE id=1", JSON.stringify(cfg));
    });
    return cfg;
  }
  student(input, id) {
    const old = id ? this.get("SELECT * FROM students WHERE id=?", +id) : null;
    if (id && !old) throw new Error("Estudiante inexistente.");
    const v = { ...old, ...input };
    required(v.nombres, "nombres");
    required(v.apellidos, "apellidos");
    return this.tx(() => {
      const params = [
        v.nombres.trim(),
        v.apellidos.trim(),
        safeText(v.ci),
        safeText(v.telefono),
        safeText(v.observaciones),
        v.active === false || v.active === 0 ? 0 : 1,
      ];
      if (id)
        this.run(
          "UPDATE students SET nombres=?,apellidos=?,ci=?,telefono=?,observaciones=?,active=? WHERE id=?",
          ...params,
          +id,
        );
      else
        id = Number(
          this.run(
            "INSERT INTO students(nombres,apellidos,ci,telefono,observaciones,active,created_at) VALUES(?,?,?,?,?,?,?)",
            ...params,
            now(),
          ).lastInsertRowid,
        );
      this.audit("students", +id, "guardar", old, v);
      return this.get("SELECT * FROM students WHERE id=?", +id);
    });
  }
  course(v, id) {
    required(v.nombre, "el curso");
    if (!categories.includes(v.categoria))
      throw new Error("Categoría inválida.");
    return this.tx(() => {
      const old = id ? this.get("SELECT * FROM courses WHERE id=?", +id) : null;
      if (id && !old) throw new Error("Curso inexistente.");
      const params = [
        v.nombre.trim(),
        v.categoria,
        v.activo === false || v.activo === 0 ? 0 : 1,
      ];
      if (id)
        this.run(
          "UPDATE courses SET nombre=?,categoria=?,activo=? WHERE id=?",
          ...params,
          +id,
        );
      else
        id = Number(
          this.run(
            "INSERT INTO courses(nombre,categoria,activo) VALUES(?,?,?)",
            ...params,
          ).lastInsertRowid,
        );
      this.audit("courses", +id, "guardar", old, v);
      return this.get("SELECT * FROM courses WHERE id=?", +id);
    });
  }
  enroll(v) {
    date(v.fecha_ingreso);
    required(v.turno, "el turno");
    return this.tx(() => {
      if (
        !this.get(
          "SELECT id FROM students WHERE id=? AND active=1",
          +v.student_id,
        ) ||
        !this.get(
          "SELECT id FROM courses WHERE id=? AND activo=1",
          +v.course_id,
        )
      )
        throw new Error("Seleccione un estudiante y curso activos.");
      if (
        v.deliberate !== true &&
        this.get(
          "SELECT id FROM enrollments WHERE student_id=? AND course_id=? AND estado='activo'",
          +v.student_id,
          +v.course_id,
        )
      )
        throw new Error(
          "Ya existe una inscripción activa. Confirme reinscripción deliberada si corresponde.",
        );
      const id = Number(
        this.run(
          "INSERT INTO enrollments(student_id,course_id,turno,horario,fecha_ingreso,estado) VALUES(?,?,?,?,?,'activo')",
          +v.student_id,
          +v.course_id,
          v.turno.trim(),
          safeText(v.horario),
          v.fecha_ingreso,
        ).lastInsertRowid,
      );
      this.audit("enrollments", id, "crear", null, v);
      return { id };
    });
  }
  enrollmentState(id, v) {
    const old = this.get("SELECT * FROM enrollments WHERE id=?", +id);
    if (!old || !["activo", "concluido", "retirado"].includes(v.estado))
      throw new Error("Inscripción o estado inválido.");
    if (v.fecha_fin) {
      date(v.fecha_fin);
      if (v.fecha_fin < old.fecha_ingreso)
        throw new Error("La fecha final es anterior al ingreso.");
    }
    this.tx(() => {
      this.run(
        "UPDATE enrollments SET estado=?,fecha_fin=? WHERE id=?",
        v.estado,
        v.fecha_fin || null,
        +id,
      );
      this.audit("enrollments", +id, "estado", old, v);
    });
    return { id: +id };
  }
  score(value) {
    const cfg = this.settings();
    if (
      value === null ||
      value === undefined ||
      typeof value === "boolean" ||
      String(value).trim() === "" ||
      !Number.isFinite(Number(value)) ||
      Number(value) < +cfg.minimo ||
      Number(value) > +cfg.maximo
    )
      throw new Error(`Ingrese una nota entre ${cfg.minimo} y ${cfg.maximo}.`);
    return +value;
  }
  grade(v) {
    if (safeText(v.observacion).length > 500)
      throw new Error("Las observaciones admiten hasta 500 caracteres.");
    period(v.periodo);
    const valor = this.score(v.valor);
    return this.tx(() => {
      if (!this.get("SELECT id FROM enrollments WHERE id=?", +v.enrollment_id))
        throw new Error("Inscripción inexistente.");
      const old = this.get(
        "SELECT * FROM grades WHERE enrollment_id=? AND tipo='final'",
        +v.enrollment_id,
      );
      if (old?.report_id)
        throw new Error("Nota presentada. Use Rectificar en Historial.");
      this.run(
        "INSERT INTO grades(enrollment_id,valor,periodo,observacion,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(enrollment_id,tipo) DO UPDATE SET valor=excluded.valor,periodo=excluded.periodo,observacion=excluded.observacion,updated_at=excluded.updated_at",
        +v.enrollment_id,
        valor,
        v.periodo,
        safeText(v.observacion),
        now(),
      );
      const row = this.get(
        "SELECT * FROM grades WHERE enrollment_id=? AND tipo='final'",
        +v.enrollment_id,
      );
      this.audit("grades", row.id, "guardar_pendiente", old, row);
      return row;
    });
  }
  enrollments() {
    return this.all(
      "SELECT e.*,s.nombres||' '||s.apellidos estudiante,c.nombre curso,c.categoria,g.id grade_id,g.valor,g.periodo,g.observacion,g.report_id FROM enrollments e JOIN students s ON s.id=e.student_id JOIN courses c ON c.id=e.course_id LEFT JOIN grades g ON g.enrollment_id=e.id ORDER BY e.id DESC",
    );
  }
  pending(category, month, shift = "") {
    period(month);
    if (!categories.includes(category)) throw new Error("Categoría inválida.");
    return this.enrollments().filter(
      (r) =>
        r.categoria === category &&
        r.grade_id !== null &&
        r.report_id === null &&
        r.periodo <= month &&
        (!shift || r.turno === shift),
    );
  }
  snapshot(category, month, shift, rows) {
    return {
      formato: REPORT_FORMAT,
      categoria: category,
      periodo: month,
      turno: shift,
      encabezado: this.settings(),
      filas: rows.sort((a, b) => a.id - b.id),
    };
  }
  draft(v) {
    if (!Array.isArray(v.grade_ids)) throw new Error("Seleccione notas.");
    const ids = [...new Set(v.grade_ids.map(Number))];
    return this.tx(() => {
      const rows = this.pending(v.categoria, v.periodo, v.turno || "").filter(
        (r) => ids.includes(r.grade_id),
      );
      if (!rows.length || rows.length !== ids.length)
        throw new Error(
          "Seleccione únicamente notas pendientes de esta categoría. No se emiten informes vacíos.",
        );
      const snap = this.snapshot(v.categoria, v.periodo, v.turno || "", rows);
      const id = Number(
        this.run(
          "INSERT INTO reports(categoria,periodo,turno,estado,snapshot,created_at) VALUES(?,?,?,'borrador',?,?)",
          v.categoria,
          v.periodo,
          v.turno || "",
          JSON.stringify(snap),
          now(),
        ).lastInsertRowid,
      );
      ids.forEach((i) =>
        this.run("INSERT INTO report_items VALUES(?,?)", id, i),
      );
      this.audit("reports", id, "vista_previa", null, snap);
      return this.report(id);
    });
  }
  report(id) {
    const r = this.get("SELECT * FROM reports WHERE id=?", +id);
    if (!r) throw new Error("Informe inexistente.");
    return { ...r, contenido: JSON.parse(r.snapshot) };
  }
  confirm(id, v) {
    if (v.confirmed !== true)
      throw new Error(
        "Debe confirmar expresamente que YA ENTREGÓ estas notas.",
      );
    required(v.responsable, "responsable");
    date(v.fecha_presentacion);
    return this.tx(() => {
      const r = this.report(id);
      if (r.estado !== "borrador")
        throw new Error("El informe ya está cerrado.");
      const snap = r.contenido;
      const ids = snap.filas.map((row) => row.grade_id);
      const current = this.snapshot(
        r.categoria,
        r.periodo,
        r.turno,
        this.pending(r.categoria, r.periodo, r.turno).filter((row) =>
          ids.includes(row.grade_id),
        ),
      );
      if (JSON.stringify(current) !== r.snapshot)
        throw new Error(
          "Los datos cambiaron desde la vista previa. Genere un nuevo borrador.",
        );
      this.run(
        "UPDATE reports SET estado='presentado',confirmado_at=?,responsable=?,snapshot=? WHERE id=?",
        now(),
        v.responsable.trim(),
        JSON.stringify({ ...snap, fecha_presentacion: v.fecha_presentacion }),
        +id,
      );
      for (const i of ids) {
        if (
          this.run(
            "UPDATE grades SET report_id=? WHERE id=? AND report_id IS NULL",
            +id,
            i,
          ).changes !== 1
        )
          throw new Error("Una nota ya fue presentada.");
      }
      this.audit("reports", +id, "confirmar_entrega", null, {
        ...v,
        grade_ids: ids,
      });
      return this.report(id);
    });
  }
  rectify(id, v) {
    if (v.confirmed !== true)
      throw new Error("Confirme que la rectificación ya fue entregada.");
    required(v.responsable, "responsable");
    required(v.motivo, "el motivo");
    date(v.fecha_presentacion);
    return this.tx(() => {
      const old = this.report(id);
      if (
        old.estado === "borrador" ||
        this.get("SELECT id FROM reports WHERE parent_id=?", +id)
      )
        throw new Error("Rectifique la versión cerrada más reciente.");
      const changes = v.corrections;
      if (
        !changes ||
        typeof changes !== "object" ||
        !Object.keys(changes).length ||
        Object.keys(changes).some(
          (k) => !old.contenido.filas.some((r) => String(r.grade_id) === k),
        )
      )
        throw new Error("Seleccione calificaciones de este informe.");
      const snap = structuredClone(old.contenido);
      snap.formato = REPORT_FORMAT;
      snap.filas.forEach((r) => {
        if (Object.hasOwn(changes, r.grade_id))
          r.valor = this.score(changes[r.grade_id]);
      });
      snap.fecha_presentacion = v.fecha_presentacion;
      snap.rectificacion = v.motivo.trim();
      const newId = Number(
        this.run(
          "INSERT INTO reports(categoria,periodo,turno,estado,version,parent_id,snapshot,created_at) VALUES(?,?,?,'borrador',?,?,?,?)",
          old.categoria,
          old.periodo,
          old.turno,
          old.version + 1,
          +id,
          JSON.stringify(snap),
          now(),
        ).lastInsertRowid,
      );
      snap.filas.forEach((row) =>
        this.run("INSERT INTO report_items VALUES(?,?)", newId, row.grade_id),
      );
      this.run(
        "UPDATE reports SET estado='rectificado',confirmado_at=?,responsable=?,motivo=? WHERE id=?",
        now(),
        v.responsable.trim(),
        v.motivo.trim(),
        newId,
      );
      this.audit("reports", newId, "rectificar", +id, v);
      return this.report(newId);
    });
  }
  state() {
    return {
      students: this.all("SELECT * FROM students ORDER BY apellidos,nombres"),
      courses: this.all("SELECT * FROM courses ORDER BY categoria,nombre"),
      enrollments: this.enrollments(),
      reports: this.all(
        "SELECT id,categoria,periodo,turno,estado,version,parent_id,confirmado_at,responsable FROM reports ORDER BY id DESC",
      ),
      settings: this.settings(),
      categories,
    };
  }
  demo() {
    if (this.get("SELECT id FROM students LIMIT 1")) return;
    const a = this.student({
      nombres: "Juan (FICTICIO)",
      apellidos: "Ejemplo",
    });
    const b = this.student({
      nombres: "María (FICTICIA)",
      apellidos: "Demostración",
    });
    for (const [s, name, turno, nota] of [
      [a, "Illustrator", "Mañana", 85],
      [a, "Photoshop", "Tarde", 0],
      [b, "Power BI", "Noche", 92],
    ]) {
      const c = this.get("SELECT id FROM courses WHERE nombre=?", name);
      const e = this.enroll({
        student_id: s.id,
        course_id: c.id,
        turno,
        horario: this.settings().horarios[turno],
        fecha_ingreso: "2026-10-01",
      });
      this.grade({
        enrollment_id: e.id,
        valor: nota,
        periodo: "2026-10",
        observacion: "DEMOSTRACIÓN FICTICIA",
      });
    }
  }
}
