"""Persistencia transaccional y reglas de entrega. La vista previa nunca presenta notas."""
import json
import re
import sqlite3
from datetime import date, datetime
from pathlib import Path

CATEGORIES = ('Diseño Gráfico', 'Paquetes Sueltos')
CATALOG = (('Illustrator', 'Photoshop', 'InDesign', 'QuarkXPress', 'CorelDRAW', '3D Max', 'Vectorworks', 'AutoCAD', 'AutoCAD Architectural', 'Archicad', 'Premiere', 'Sony Vegas'), ('Python', 'Java', 'SolidWorks', 'Revit', 'Inteligencia Artificial', 'Marketing Digital', 'Power BI', 'Filmora'))
DEFAULTS = dict(institucion='CEICOM', destinatario='', cargo_destinatario='Directora Académica', docente='', cargo_docente='', firma='', logo='', minimo=0, maximo=100, horarios={'Mañana':'Lunes, miércoles y viernes · 08:00–12:00', 'Tarde':'Lunes, miércoles y viernes · 15:00–18:00', 'Noche':'Lunes, miércoles y viernes · 18:00–21:00'})


def now():
    return datetime.now().astimezone().isoformat(timespec='seconds')


def period(value):
    if not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', value) or int(value[:4]) < 1900:
        raise ValueError('Período inválido: use AAAA-MM.')
    return value


class Store:
    def __init__(self, root):
        self.root = Path(root)
        (self.root / 'datos').mkdir(parents=True, exist_ok=True)
        (self.root / 'Informes').mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.root / 'datos/ceicom.sqlite3')
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS students(id INTEGER PRIMARY KEY, nombres TEXT NOT NULL, apellidos TEXT NOT NULL, ci TEXT DEFAULT '', telefono TEXT DEFAULT '', observaciones TEXT DEFAULT '', active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)), created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS courses(id INTEGER PRIMARY KEY, nombre TEXT UNIQUE NOT NULL, categoria TEXT NOT NULL CHECK(categoria IN('Diseño Gráfico','Paquetes Sueltos')), activo INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS enrollments(id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), course_id INTEGER NOT NULL REFERENCES courses(id), turno TEXT NOT NULL, horario TEXT NOT NULL, fecha_ingreso TEXT NOT NULL, fecha_fin TEXT, estado TEXT NOT NULL CHECK(estado IN('activo','concluido','retirado')));
        CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY, categoria TEXT NOT NULL, periodo TEXT NOT NULL, turno TEXT NOT NULL, estado TEXT NOT NULL CHECK(estado IN('borrador','presentado','rectificado')), version INTEGER NOT NULL DEFAULT 1, parent_id INTEGER REFERENCES reports(id), snapshot TEXT NOT NULL, created_at TEXT NOT NULL, confirmado_at TEXT, responsable TEXT, motivo TEXT);
        CREATE TABLE IF NOT EXISTS grades(id INTEGER PRIMARY KEY, enrollment_id INTEGER NOT NULL REFERENCES enrollments(id), tipo TEXT NOT NULL DEFAULT 'final', valor REAL NOT NULL, periodo TEXT NOT NULL, observacion TEXT NOT NULL, report_id INTEGER REFERENCES reports(id), updated_at TEXT NOT NULL, UNIQUE(enrollment_id,tipo));
        CREATE TABLE IF NOT EXISTS report_items(report_id INTEGER NOT NULL REFERENCES reports(id), grade_id INTEGER NOT NULL REFERENCES grades(id), PRIMARY KEY(report_id,grade_id));
        CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY, entidad TEXT NOT NULL, entidad_id INTEGER, accion TEXT NOT NULL, antes_json TEXT, despues_json TEXT, fecha TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS grades_pending ON grades(report_id,periodo);
        CREATE INDEX IF NOT EXISTS reports_period ON reports(categoria,periodo,turno);
        CREATE TRIGGER IF NOT EXISTS immutable_report_update BEFORE UPDATE ON reports WHEN OLD.estado != 'borrador' BEGIN SELECT RAISE(ABORT,'Informe histórico inmutable'); END;
        CREATE TRIGGER IF NOT EXISTS immutable_report_delete BEFORE DELETE ON reports WHEN OLD.estado != 'borrador' BEGIN SELECT RAISE(ABORT,'Informe histórico inmutable'); END;
        CREATE TRIGGER IF NOT EXISTS delivered_grade_update BEFORE UPDATE ON grades WHEN OLD.report_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'Use rectificación para notas presentadas'); END;
        CREATE TRIGGER IF NOT EXISTS delivered_grade_delete BEFORE DELETE ON grades WHEN OLD.report_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'Nota presentada protegida'); END;
        ''')
        with self.db:
            self.db.execute('INSERT OR IGNORE INTO settings VALUES(1,?)', (json.dumps(DEFAULTS, ensure_ascii=False),))
            # Sembrar solo al crear el catálogo; no reactivar cursos editados o retirados.
            if not self.db.execute('SELECT 1 FROM courses LIMIT 1').fetchone():
                for category, names in zip(CATEGORIES, CATALOG):
                    self.db.executemany('INSERT INTO courses(nombre,categoria) VALUES(?,?)', [(n, category) for n in names])

    def rows(self, sql, args=()):
        return [dict(r) for r in self.db.execute(sql, args)]

    def audit(self, entity, ident, action, before, after):
        self.db.execute('INSERT INTO audit_log(entidad,entidad_id,accion,antes_json,despues_json,fecha) VALUES(?,?,?,?,?,?)', (entity, ident, action, json.dumps(before, ensure_ascii=False), json.dumps(after, ensure_ascii=False), now()))

    def settings(self):
        return json.loads(self.db.execute('SELECT value FROM settings WHERE id=1').fetchone()[0])

    def save_settings(self, value):
        import math
        if not all(math.isfinite(float(value[k])) for k in ('minimo','maximo')) or float(value['minimo']) >= float(value['maximo']):
            raise ValueError('La escala mínima debe ser menor a la máxima.')
        with self.db:
            self.audit('settings', 1, 'editar', self.settings(), value)
            self.db.execute('UPDATE settings SET value=? WHERE id=1', (json.dumps(value, ensure_ascii=False),))

    def student(self, nombres, apellidos, ci='', telefono='', observaciones='', ident=None, active=1):
        if not nombres.strip() or not apellidos.strip():
            raise ValueError('Complete nombres y apellidos.')
        data = (nombres.strip(), apellidos.strip(), ci.strip(), telefono.strip(), observaciones, int(active))
        with self.db:
            before = self.rows('SELECT * FROM students WHERE id=?', (ident,))
            if ident:
                self.db.execute('UPDATE students SET nombres=?,apellidos=?,ci=?,telefono=?,observaciones=?,active=? WHERE id=?', (*data, ident))
            else:
                ident = self.db.execute('INSERT INTO students(nombres,apellidos,ci,telefono,observaciones,active,created_at) VALUES(?,?,?,?,?,?,?)', (*data, now())).lastrowid
            self.audit('students', ident, 'guardar', before, data)
        return ident

    def course(self, name, category, active=1, ident=None):
        if not name.strip() or category not in CATEGORIES:
            raise ValueError('Curso o categoría inválidos.')
        with self.db:
            before = self.rows('SELECT * FROM courses WHERE id=?', (ident,))
            if ident:
                self.db.execute('UPDATE courses SET nombre=?,categoria=?,activo=? WHERE id=?', (name.strip(), category, int(active), ident))
            else:
                ident = self.db.execute('INSERT INTO courses(nombre,categoria,activo) VALUES(?,?,?)', (name.strip(), category, int(active))).lastrowid
            self.audit('courses', ident, 'guardar', before, [name, category, active])
        return ident

    def enroll(self, student, course, shift, start, schedule='', deliberate=False):
        date.fromisoformat(start)
        if not shift.strip():
            raise ValueError('Indique turno o grupo.')
        with self.db:
            if not self.rows('SELECT id FROM students WHERE id=? AND active=1', (student,)) or not self.rows('SELECT id FROM courses WHERE id=? AND activo=1', (course,)):
                raise ValueError('Seleccione un estudiante y curso activos.')
            if not deliberate and self.rows("SELECT id FROM enrollments WHERE student_id=? AND course_id=? AND estado='activo'", (student, course)):
                raise ValueError('Ya existe inscripción activa. Marque reinscripción deliberada si corresponde.')
            ident = self.db.execute("INSERT INTO enrollments(student_id,course_id,turno,horario,fecha_ingreso,estado) VALUES(?,?,?,?,?,'activo')", (student, course, shift.strip(), schedule, start)).lastrowid
            self.audit('enrollments', ident, 'crear', None, [student, course, shift, start, schedule])
        return ident

    def enrollment_state(self, ident, state, end=None):
        if state not in ('activo', 'concluido', 'retirado'):
            raise ValueError('Estado inválido.')
        if end:
            date.fromisoformat(end)
        with self.db:
            before = self.rows('SELECT * FROM enrollments WHERE id=?', (ident,))
            if not before or (end and end < before[0]['fecha_ingreso']):
                raise ValueError('Fecha final anterior al ingreso o inscripción inexistente.')
            self.db.execute('UPDATE enrollments SET estado=?,fecha_fin=? WHERE id=?', (state, end, ident))
            self.audit('enrollments', ident, 'estado', before, [state, end])

    def grade(self, enrollment, value, academic_period, observation=''):
        import math
        period(academic_period)
        cfg = self.settings()
        value = float(value)
        if not math.isfinite(value) or not float(cfg['minimo']) <= value <= float(cfg['maximo']):
            raise ValueError('Nota fuera de la escala configurada.')
        with self.db:
            old = self.rows("SELECT * FROM grades WHERE enrollment_id=? AND tipo='final'", (enrollment,))
            if old and old[0]['report_id']:
                raise ValueError('Nota presentada. Rectifique el informe desde Historial.')
            self.db.execute("INSERT INTO grades(enrollment_id,valor,periodo,observacion,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(enrollment_id,tipo) DO UPDATE SET valor=excluded.valor,periodo=excluded.periodo,observacion=excluded.observacion,updated_at=excluded.updated_at", (enrollment, value, academic_period, observation, now()))
            ident = self.db.execute('SELECT id FROM grades WHERE enrollment_id=?', (enrollment,)).fetchone()[0]
            self.audit('grades', ident, 'guardar_borrador', old, [value, academic_period, observation])
        return ident

    def enrollments(self):
        return self.rows('''SELECT e.*, s.nombres||' '||s.apellidos estudiante,c.nombre curso,c.categoria,g.id grade_id,g.valor,g.periodo,g.observacion,g.report_id FROM enrollments e JOIN students s ON s.id=e.student_id JOIN courses c ON c.id=e.course_id LEFT JOIN grades g ON g.enrollment_id=e.id ORDER BY e.id DESC''')

    def pending(self, category, academic_period, shift=''):
        period(academic_period)
        # Arrastre de notas no presentadas de meses anteriores; no incluye notas futuras.
        return [r for r in self.enrollments() if r['categoria'] == category and r['grade_id'] and r['report_id'] is None and r['periodo'] <= academic_period and (not shift or r['turno'] == shift)]

    def snapshot(self, category, academic_period, shift, rows):
        cfg = self.settings()
        # Incluir bytes del logo para que cambios posteriores no afecten al archivo histórico.
        logo = cfg.pop('logo', '')
        if logo:
            import base64
            cfg['logo_base64'] = base64.b64encode(Path(logo).read_bytes()).decode()
        return dict(categoria=category, periodo=academic_period, turno=shift, encabezado=cfg, filas=sorted(rows, key=lambda r:(r['turno'],r['curso'],r['estudiante'])))

    def draft(self, category, academic_period, grade_ids, shift=''):
        if category not in CATEGORIES:
            raise ValueError('Categoría inválida.')
        ids = set(grade_ids)
        rows = [r for r in self.pending(category, academic_period, shift) if r['grade_id'] in ids]
        if not rows or len(rows) != len(ids):
            raise ValueError('Seleccione solo notas pendientes válidas; no se emiten informes vacíos.')
        snap = self.snapshot(category, academic_period, shift, rows)
        with self.db:
            ident = self.db.execute("INSERT INTO reports(categoria,periodo,turno,estado,snapshot,created_at) VALUES(?,?,?,'borrador',?,?)", (category, academic_period, shift, json.dumps(snap, ensure_ascii=False), now())).lastrowid
            self.db.executemany('INSERT INTO report_items VALUES(?,?)', [(ident, i) for i in ids])
            self.audit('reports', ident, 'vista_previa', None, snap)
        return ident

    def report(self, ident):
        rows = self.rows('SELECT * FROM reports WHERE id=?', (ident,))
        if not rows:
            raise ValueError('Informe inexistente.')
        result = rows[0]
        result['contenido'] = json.loads(result['snapshot'])
        return result

    def confirm(self, ident, responsible, delivery_date, explicit=False):
        if not explicit or not responsible.strip():
            raise ValueError('Debe confirmar expresamente la entrega e indicar responsable.')
        date.fromisoformat(delivery_date)
        with self.db:
            self.db.execute('BEGIN IMMEDIATE')
            r = self.report(ident)
            if r['estado'] != 'borrador':
                raise ValueError('Este informe ya está cerrado.')
            original = r['contenido']
            ids = {i['grade_id'] for i in original['filas']}
            rows = [i for i in self.pending(r['categoria'], r['periodo'], r['turno']) if i['grade_id'] in ids]
            current = self.snapshot(r['categoria'], r['periodo'], r['turno'], rows)
            if current != original:
                raise ValueError('Los datos cambiaron desde la vista previa. Genere otro borrador antes de confirmar.')
            self.db.execute("UPDATE reports SET estado='presentado', confirmado_at=?, responsable=?, snapshot=? WHERE id=?", (now(), responsible.strip(), json.dumps(dict(original, fecha_presentacion=delivery_date), ensure_ascii=False), ident))
            for grade_id in ids:
                cursor = self.db.execute('UPDATE grades SET report_id=? WHERE id=? AND report_id IS NULL', (ident, grade_id))
                if cursor.rowcount != 1:
                    raise ValueError('Una nota ya fue presentada en otro informe.')
            self.audit('reports', ident, 'confirmar_entrega', None, dict(responsable=responsible, fecha=delivery_date, notas=sorted(ids)))

    def rectify(self, ident, corrections, reason, responsible, delivery_date, explicit=False):
        """Nueva versión sobre instantánea; nunca reescribe notas ni versiones anteriores."""
        import copy
        if not explicit or not reason.strip() or not responsible.strip():
            raise ValueError('Confirme la rectificación, responsable y motivo.')
        date.fromisoformat(delivery_date)
        corrections = {str(k):v for k,v in corrections.items()}
        with self.db:
            self.db.execute('BEGIN IMMEDIATE')
            old = self.report(ident)
            if old['estado'] == 'borrador':
                raise ValueError('Solo se rectifican informes cerrados.')
            if self.rows('SELECT id FROM reports WHERE parent_id=?', (ident,)):
                raise ValueError('Rectifique la versión más reciente de este informe.')
            snap = copy.deepcopy(old['contenido'])
            known = {str(row['grade_id']) for row in snap['filas']}
            if not corrections or not set(map(str, corrections)) <= known:
                raise ValueError('Seleccione calificaciones del informe.')
            cfg = self.settings()
            import math
            for row in snap['filas']:
                if str(row['grade_id']) in corrections:
                    value = float(corrections[str(row['grade_id'])])
                    if not math.isfinite(value) or not float(cfg['minimo']) <= value <= float(cfg['maximo']):
                        raise ValueError('Nota fuera de escala.')
                    row['valor'] = value
            snap['fecha_presentacion'] = delivery_date
            snap['rectificacion'] = reason
            new_id = self.db.execute("INSERT INTO reports(categoria,periodo,turno,estado,version,parent_id,snapshot,created_at,confirmado_at,responsable,motivo) VALUES(?,?,?,'rectificado',?,?,?,?,?,?,?)", (old['categoria'],old['periodo'],old['turno'],old['version']+1,ident,json.dumps(snap, ensure_ascii=False),now(),now(),responsible,reason)).lastrowid
            self.db.executemany('INSERT INTO report_items VALUES(?,?)', [(new_id,row['grade_id']) for row in snap['filas']])
            self.audit('reports', new_id, 'rectificar', ident, dict(motivo=reason, cambios=corrections))
        return new_id
