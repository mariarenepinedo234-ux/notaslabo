"""Interfaz de escritorio en español. Las acciones de entrega requieren confirmación."""
from datetime import date
from pathlib import Path
import shutil

from PySide6.QtCore import Qt, QDate
from PySide6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QTabWidget, QTableWidget, QTableWidgetItem, QLineEdit, QComboBox, QFormLayout, QDialog, QDialogButtonBox, QMessageBox, QCheckBox, QDateEdit, QFileDialog, QTextEdit, QDoubleSpinBox, QHeaderView, QAbstractItemView)
from .store import CATEGORIES
from .exports import export_report
from .backup import backup, restore

STYLE = '''
QMainWindow, QDialog {background:#f3f4f7; color:#242833; font-family:Segoe UI; font-size:10pt;}
QLabel#brand {background:#781d3b;color:white;padding:18px;font-size:23pt;font-weight:700;}
QLabel#sub {color:#626878;padding:8px;}
QTabWidget::pane {background:white;border:1px solid #dce0e6;border-radius:8px;}
QTabBar::tab {padding:13px 15px;background:#e8eaf0;}
QTabBar::tab:selected {background:#781d3b;color:white;}
QPushButton {background:#781d3b;color:white;border:0;border-radius:5px;padding:9px 14px;}
QPushButton:hover {background:#9a3152;} QPushButton:disabled {background:#b6b8bf;}
QLineEdit,QComboBox,QDateEdit,QDoubleSpinBox,QTextEdit {padding:7px;background:white;border:1px solid #cbd0db;border-radius:4px;}
QTableWidget {background:white;border:0;gridline-color:#e6e8ee;alternate-background-color:#f6f7fa;selection-background-color:#edd3dc;selection-color:#242833;}
QHeaderView::section {background:#f1da83;border:0;padding:9px;font-weight:600;}
QLabel#cards {background:white;border-left:5px solid #e8c44a;padding:22px;font-size:17pt;}
'''


def combo(items, editable=False):
    c = QComboBox()
    for text, value in items:
        c.addItem(str(text), value)
    c.setEditable(editable)
    return c


def line(value=''):
    return QLineEdit(str(value or ''))


def date_edit(value=None):
    e = QDateEdit()
    e.setCalendarPopup(True)
    e.setDisplayFormat('yyyy-MM-dd')
    e.setDate(QDate.fromString(value or date.today().isoformat(),'yyyy-MM-dd'))
    return e


def text(w):
    if isinstance(w,QComboBox):
        return w.currentText()
    if isinstance(w,QDateEdit):
        return w.date().toString('yyyy-MM-dd')
    return w.text().strip()


class Window(QMainWindow):
    def __init__(self, store, demo=False):
        super().__init__()
        self.store = store
        self.setWindowTitle('CEICOM · Sistema académico' + (' · DEMOSTRACIÓN FICTICIA' if demo else ''))
        self.resize(1320,850)
        self.setMinimumSize(960,650)
        self.setStyleSheet(STYLE)
        central = QWidget()
        layout = QVBoxLayout(central)
        brand = QLabel('CEICOM  /  Control académico')
        brand.setObjectName('brand')
        layout.addWidget(brand)
        self.subtitle = QLabel(('DEMOSTRACIÓN · Datos ficticios · ' if demo else '') + f'Datos locales: {store.root}  |  Guardar una nota no confirma su entrega.')
        self.subtitle.setObjectName('sub')
        layout.addWidget(self.subtitle)
        self.tabs = QTabWidget()
        layout.addWidget(self.tabs)
        self.setCentralWidget(central)
        self.pages = {}
        for name in ('Panel','Estudiantes','Inscripciones','Calificaciones','Informes','Historial','Configuración'):
            widget = QWidget()
            self.pages[name] = QVBoxLayout(widget)
            self.tabs.addTab(widget,name)
        self.build_panel()
        self.build_students()
        self.build_enrollments()
        self.build_grades()
        self.build_reports()
        self.build_history()
        self.build_settings()
        self.refresh()

    def run(self, callback):
        try:
            callback()
        except Exception as e:
            QMessageBox.warning(self,'No se pudo completar',str(e))

    def button(self, layout, label, callback):
        b = QPushButton(label)
        b.clicked.connect(lambda:self.run(callback))
        layout.addWidget(b)
        return b

    def toolbar(self, page):
        h = QHBoxLayout()
        self.pages[page].addLayout(h)
        return h

    def table(self, page, headers):
        t = QTableWidget(0,len(headers))
        t.setHorizontalHeaderLabels(headers)
        t.setAlternatingRowColors(True)
        t.setSelectionBehavior(QAbstractItemView.SelectRows)
        t.setSelectionMode(QAbstractItemView.SingleSelection)
        t.setEditTriggers(QAbstractItemView.NoEditTriggers)
        t.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeToContents)
        t.horizontalHeader().setStretchLastSection(True)
        t.verticalHeader().hide()
        self.pages[page].addWidget(t)
        return t

    def fill(self, table, rows, keys):
        table.setRowCount(len(rows))
        for rownum,row in enumerate(rows):
            for col,key in enumerate(keys):
                value = row.get(key)
                item = QTableWidgetItem('—' if value is None else str(value))
                item.setData(Qt.UserRole,row.get('id'))
                table.setItem(rownum,col,item)

    def selected(self, table):
        if table.currentRow() < 0:
            raise ValueError('Seleccione una fila.')
        return table.item(table.currentRow(),0).data(Qt.UserRole)

    def dialog(self, title, fields, save):
        d = QDialog(self)
        d.setWindowTitle(title)
        d.setMinimumWidth(540)
        layout = QVBoxLayout(d)
        form = QFormLayout()
        for label,widget in fields:
            form.addRow(label,widget)
        layout.addLayout(form)
        buttons = QDialogButtonBox(QDialogButtonBox.Save|QDialogButtonBox.Cancel)
        layout.addWidget(buttons)
        buttons.rejected.connect(d.reject)
        def commit():
            try:
                save()
                d.accept()
                self.refresh()
            except Exception as e:
                QMessageBox.warning(d,'Revise los datos',str(e))
        buttons.accepted.connect(commit)
        return d.exec()

    def build_panel(self):
        self.cards = QLabel()
        self.cards.setObjectName('cards')
        self.pages['Panel'].addWidget(self.cards)
        self.pages['Panel'].addWidget(QLabel('Flujo mensual: registrar estudiantes → inscribir por curso → guardar notas → revisar informe → confirmar entrega.\n\nLas notas sin entrega confirmada se arrastran a los períodos posteriores.\nCada categoría tiene su propio informe; los informes cerrados conservan su contenido original.'))
        h = self.toolbar('Panel')
        for label,index in [('Registrar estudiante',1),('Calificar',3),('Preparar informe',4),('Consultar historial',5)]:
            self.button(h,label,lambda i=index:self.tabs.setCurrentIndex(i))
        self.pages['Panel'].addStretch()

    def build_students(self):
        h = self.toolbar('Estudiantes')
        self.search = line()
        self.search.setPlaceholderText('Buscar por nombre, apellido o CI…')
        self.search.textChanged.connect(self.refresh_students)
        h.addWidget(self.search)
        self.button(h,'+ Estudiante',lambda:self.edit_student())
        self.button(h,'Editar / desactivar',lambda:self.edit_student(self.selected(self.students_table)))
        self.students_table = self.table('Estudiantes',['ID','Nombres','Apellidos','CI','Teléfono','Activo','Observaciones'])

    def refresh_students(self):
        q = '%' + self.search.text() + '%'
        self.fill(self.students_table,self.store.rows('SELECT * FROM students WHERE nombres LIKE ? OR apellidos LIKE ? OR ci LIKE ? ORDER BY apellidos,nombres',(q,q,q)),['id','nombres','apellidos','ci','telefono','active','observaciones'])

    def edit_student(self, ident=None):
        row = self.store.rows('SELECT * FROM students WHERE id=?',(ident,))[0] if ident else {}
        fields = {k:line(row.get(k,'')) for k in ('nombres','apellidos','ci','telefono','observaciones')}
        active = QCheckBox('Estudiante activo')
        active.setChecked(bool(row.get('active',1)))
        labels = ['Nombres *','Apellidos *','CI (opcional)','Teléfono (opcional)','Observaciones']
        self.dialog('Estudiante',list(zip(labels,fields.values()))+[('Estado',active)],lambda:self.store.student(**{k:text(w) for k,w in fields.items()},ident=ident,active=active.isChecked()))

    def build_enrollments(self):
        h = self.toolbar('Inscripciones')
        self.button(h,'+ Inscribir a un curso',self.new_enrollment)
        self.button(h,'Cambiar estado / finalización',self.edit_enrollment)
        self.enrollment_table = self.table('Inscripciones',['ID','Estudiante','Curso','Categoría','Turno','Horario','Ingreso','Estado','Fin'])

    def new_enrollment(self):
        students = self.store.rows('SELECT * FROM students WHERE active=1 ORDER BY apellidos')
        courses = self.store.rows('SELECT * FROM courses WHERE activo=1 ORDER BY categoria,nombre')
        if not students or not courses:
            raise ValueError('Primero registre estudiantes y cursos activos.')
        s = combo([(f"{r['apellidos']}, {r['nombres']} · #{r['id']}",r['id']) for r in students])
        c = combo([(f"{r['categoria']} / {r['nombre']}",r['id']) for r in courses])
        schedules = self.store.settings()['horarios']
        shift = combo([(k,k) for k in schedules],True)
        schedule = line(schedules.get(shift.currentText(),''))
        shift.currentTextChanged.connect(lambda v:schedule.setText(schedules.get(v,'')))
        start = date_edit()
        deliberate = QCheckBox('Confirmo que se trata de una reinscripción deliberada')
        self.dialog('Inscripción individual',[('Estudiante',s),('Curso',c),('Turno / grupo',shift),('Días y horas',schedule),('Fecha de ingreso',start),('',deliberate)],lambda:self.store.enroll(s.currentData(),c.currentData(),text(shift),text(start),text(schedule),deliberate.isChecked()))

    def edit_enrollment(self):
        ident = self.selected(self.enrollment_table)
        row = next(r for r in self.store.enrollments() if r['id']==ident)
        state = combo([(v,v) for v in ('activo','concluido','retirado')])
        state.setCurrentText(row['estado'])
        end = date_edit(row['fecha_fin'])
        enabled = QCheckBox('Registrar fecha de finalización')
        enabled.setChecked(bool(row['fecha_fin']))
        self.dialog('Estado de inscripción',[('Estado',state),('',enabled),('Fecha final',end)],lambda:self.store.enrollment_state(ident,text(state),text(end) if enabled.isChecked() else None))

    def build_grades(self):
        h = self.toolbar('Calificaciones')
        self.grade_course = line()
        self.grade_course.setPlaceholderText('Filtrar curso')
        self.grade_shift = line()
        self.grade_shift.setPlaceholderText('Filtrar turno')
        self.grade_period = line()
        self.grade_period.setPlaceholderText('Mes de nota AAAA-MM (opcional)')
        for w in (self.grade_course,self.grade_shift,self.grade_period):
            h.addWidget(w)
            w.textChanged.connect(self.refresh_grades)
        self.button(h,'Guardar nota / editar borrador',self.edit_grade)
        self.grades_table = self.table('Calificaciones',['Inscripción','Estudiante','Curso','Turno','Nota','Mes académico','Observaciones','Informe presentado'])
        self.pages['Calificaciones'].addWidget(QLabel('— = sin nota. 0 es una nota válida. Una nota presentada se corrige desde Historial → Rectificar.'))

    def refresh_grades(self):
        rows = [r for r in self.store.enrollments() if self.grade_course.text().lower() in r['curso'].lower() and self.grade_shift.text().lower() in r['turno'].lower() and (not self.grade_period.text() or r['periodo']==self.grade_period.text())]
        self.fill(self.grades_table,rows,['id','estudiante','curso','turno','valor','periodo','observacion','report_id'])

    def edit_grade(self):
        ident = self.selected(self.grades_table)
        row = next(r for r in self.store.enrollments() if r['id']==ident)
        if row['report_id']:
            raise ValueError('Esta nota ya fue presentada. Use Historial → Rectificar.')
        value = line('' if row['valor'] is None else row['valor'])
        academic = line(row['periodo'] or date.today().strftime('%Y-%m'))
        obs = line(row['observacion'] or '')
        self.dialog(f"Calificar · {row['estudiante']} · {row['curso']}",[('Nota (no confunde vacío con cero)',value),('Mes académico AAAA-MM',academic),('Observaciones',obs)],lambda:self.store.grade(ident,text(value),text(academic),text(obs)))

    def build_reports(self):
        h = self.toolbar('Informes')
        self.report_category = combo([(v,v) for v in CATEGORIES])
        self.report_period = line(date.today().strftime('%Y-%m'))
        self.report_shift = line()
        self.report_shift.setPlaceholderText('Turno exacto (vacío = todos)')
        for w in (self.report_category,self.report_period,self.report_shift):
            h.addWidget(w)
        self.button(h,'Consultar pendientes',self.pending_rows)
        h2 = self.toolbar('Informes')
        self.button(h2,'Seleccionar todas',lambda:self.check_all(True))
        self.button(h2,'Quitar selección',lambda:self.check_all(False))
        self.button(h2,'Crear vista previa de seleccionadas',self.preview)
        self.pending_table = self.table('Informes',['Incluir','Estudiante','Curso','Turno','Nota','Mes de nota','Ingreso'])
        self.pages['Informes'].addWidget(QLabel('Se incluyen pendientes del período elegido y anteriores. La vista previa no confirma entrega.\nPrepare un informe separado para cada categoría. La fecha de entrega se indica al confirmar.'))

    def pending_rows(self):
        rows = self.store.pending(text(self.report_category),text(self.report_period),text(self.report_shift))
        self.fill(self.pending_table,rows,['grade_id','estudiante','curso','turno','valor','periodo','fecha_ingreso'])
        for i,row in enumerate(rows):
            item = self.pending_table.item(i,0)
            item.setData(Qt.UserRole,row['grade_id'])
            item.setText('')
            item.setFlags(Qt.ItemIsEnabled|Qt.ItemIsUserCheckable)
            item.setCheckState(Qt.Unchecked)
        if not rows:
            QMessageBox.information(self,'Sin notas pendientes','No existen notas pendientes con estos filtros. No se emitirá un informe vacío.')

    def check_all(self, value):
        for i in range(self.pending_table.rowCount()):
            self.pending_table.item(i,0).setCheckState(Qt.Checked if value else Qt.Unchecked)

    def preview(self):
        ids = [self.pending_table.item(i,0).data(Qt.UserRole) for i in range(self.pending_table.rowCount()) if self.pending_table.item(i,0).checkState()==Qt.Checked]
        ident = self.store.draft(text(self.report_category),text(self.report_period),ids,text(self.report_shift))
        self.refresh()
        self.view_report(ident)

    def build_history(self):
        h = self.toolbar('Historial')
        self.history_filter = line()
        self.history_filter.setPlaceholderText('Buscar categoría, AAAA-MM, turno o estado…')
        self.history_filter.textChanged.connect(self.refresh_history)
        h.addWidget(self.history_filter)
        filters = self.toolbar('Historial')
        self.history_category = combo([('Todas las categorías','')]+[(v,v) for v in CATEGORIES])
        self.history_state = combo([('Todos los estados','')]+[(v,v) for v in ('borrador','presentado','rectificado')])
        self.history_year = line()
        self.history_year.setPlaceholderText('Año (AAAA)')
        self.history_month = combo([('Todos los meses','')]+[(f'{v:02d}',f'{v:02d}') for v in range(1,13)])
        self.history_shift = line()
        self.history_shift.setPlaceholderText('Turno / grupo')
        for w in (self.history_category,self.history_state,self.history_year,self.history_month,self.history_shift):
            filters.addWidget(w)
            if isinstance(w,QComboBox):
                w.currentTextChanged.connect(self.refresh_history)
            else:
                w.textChanged.connect(self.refresh_history)
        self.button(h,'Ver / exportar / confirmar entrega',lambda:self.view_report(self.selected(self.history_table)))
        self.button(h,'Rectificar versión',self.rectify_report)
        self.history_table = self.table('Historial',['ID','Categoría','Período académico','Turno','Estado','Versión','Versión anterior','Cierre','Responsable'])

    def refresh_history(self):
        query = self.history_filter.text().lower()
        rows = self.store.rows('SELECT * FROM reports ORDER BY id DESC')
        rows = [r for r in rows if all(term in ' '.join(str(r[k] or '') for k in ('categoria','periodo','turno','estado')).lower() for term in query.split())
                and (not self.history_category.currentData() or r['categoria']==self.history_category.currentData())
                and (not self.history_state.currentData() or r['estado']==self.history_state.currentData())
                and (not self.history_year.text() or r['periodo'][:4]==self.history_year.text())
                and (not self.history_month.currentData() or r['periodo'][5:]==self.history_month.currentData())
                and self.history_shift.text().lower() in r['turno'].lower()]
        self.fill(self.history_table,rows,['id','categoria','periodo','turno','estado','version','parent_id','confirmado_at','responsable'])

    def view_report(self, ident):
        r = self.store.report(ident)
        snap = r['contenido']
        d = QDialog(self)
        d.setWindowTitle(f"Informe {ident} · {r['categoria']} · {r['estado']} · v{r['version']}")
        d.resize(1000,650)
        layout = QVBoxLayout(d)
        layout.addWidget(QLabel(f"Mes académico: {r['periodo']}  |  Fecha de entrega: {snap.get('fecha_presentacion','Sin confirmar')}\nDestinatario: {snap['encabezado'].get('destinatario','')}\nSolo se presentarán las {len(snap['filas'])} notas de esta instantánea."))
        t = QTableWidget(0,6)
        t.setHorizontalHeaderLabels(['Estudiante','Curso','Turno','Nota','Mes de nota','Observaciones'])
        t.setEditTriggers(QAbstractItemView.NoEditTriggers)
        t.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.fill(t,snap['filas'],['estudiante','curso','turno','valor','periodo','observacion'])
        layout.addWidget(t)
        def export():
            paths = export_report(self.store,ident)
            folder = QFileDialog.getExistingDirectory(d,'Guardar copia de PDF y Excel (Cancelar conserva los archivos internos)')
            if folder:
                for source in paths:
                    target = Path(folder)/source.name
                    if target.resolve()!=source.resolve():
                        if target.exists() and QMessageBox.question(d,'Reemplazar copia',f'¿Reemplazar {target.name}?')!=QMessageBox.Yes:
                            continue
                        shutil.copy2(source,target)
            QMessageBox.information(d,'Informe exportado','PDF y XLSX archivados en:\n'+'\n'.join(str(p) for p in paths))
        self.button(layout,'Exportar PDF + Excel',export)
        if r['estado']=='borrador':
            responsible = line(self.store.settings().get('docente',''))
            delivery = date_edit()
            confirmation = QCheckBox('Confirmo que YA ENTREGUÉ estas notas a Dirección Académica')
            form = QFormLayout()
            form.addRow('Responsable *',responsible)
            form.addRow('Fecha real de entrega',delivery)
            form.addRow('',confirmation)
            layout.addLayout(form)
            def confirm():
                if not confirmation.isChecked():
                    raise ValueError('Marque la confirmación de entrega solo después de presentar las notas.')
                if QMessageBox.question(d,'Confirmar entrega definitiva','¿Confirma que YA PRESENTÓ exactamente estas notas? Se conservará una instantánea histórica.') != QMessageBox.Yes:
                    return
                self.store.confirm(ident,text(responsible),text(delivery),explicit=True)
                self.refresh()
                try:
                    export_report(self.store,ident)
                except Exception as e:
                    QMessageBox.warning(d,'Entrega registrada; exportación pendiente',f'El informe quedó cerrado correctamente. Reintente exportar desde Historial.\n{e}')
                d.accept()
            self.button(layout,'Confirmar entrega y cerrar informe',confirm)
        self.button(layout,'Cerrar',d.accept)
        d.exec()

    def rectify_report(self):
        ident = self.selected(self.history_table)
        r = self.store.report(ident)
        if r['estado']=='borrador':
            raise ValueError('Los borradores no se rectifican; genere una nueva vista previa.')
        rows = r['contenido']['filas']
        selected = combo([(f"{row['estudiante']} · {row['curso']} · nota {row['valor']}",row['grade_id']) for row in rows])
        value,reason = line(),line()
        responsible = line(self.store.settings().get('docente',''))
        delivery = date_edit()
        confirmed = QCheckBox('Confirmo que esta rectificación YA FUE ENTREGADA')
        def save():
            new_id = self.store.rectify(ident,{str(selected.currentData()):text(value)},text(reason),text(responsible),text(delivery),explicit=confirmed.isChecked())
            try:
                export_report(self.store,new_id)
            except Exception as e:
                QMessageBox.warning(self,'Rectificación guardada; exportación pendiente',str(e))
        self.dialog('Rectificar en una nueva versión',[('Calificación a corregir',selected),('Nueva nota',value),('Motivo *',reason),('Responsable *',responsible),('Fecha real de entrega',delivery),('',confirmed)],save)

    def build_settings(self):
        h = self.toolbar('Configuración')
        self.button(h,'Datos institucionales / escala / horarios / logo',self.edit_settings)
        self.button(h,'+ Curso',lambda:self.edit_course())
        self.button(h,'Editar curso seleccionado',lambda:self.edit_course(self.selected(self.courses_table)))
        h2 = self.toolbar('Configuración')
        self.button(h2,'Crear copia de seguridad',self.create_backup)
        self.button(h2,'Restaurar respaldo…',self.restore_backup)
        self.courses_table = self.table('Configuración',['ID','Curso','Categoría','Activo'])
        self.pages['Configuración'].addWidget(QLabel('Datos e informes se guardan junto a la aplicación. Para cambiar la ubicación, use CEICOM_HOME antes de iniciar.\nLa copia de seguridad incluye SQLite e informes. Guarde una copia en otro dispositivo.'))

    def edit_settings(self):
        cfg = self.store.settings()
        keys = [('institucion','Institución'),('destinatario','Destinatario'),('cargo_destinatario','Cargo destinatario'),('docente','Docente'),('cargo_docente','Cargo docente'),('firma','Texto de firma'),('logo','Ruta de logo PNG/JPG (opcional)'),('minimo','Nota mínima'),('maximo','Nota máxima')]
        widgets = {k:line(cfg.get(k,'')) for k,_ in keys}
        schedules = QTextEdit('\n'.join(k+'='+v for k,v in cfg['horarios'].items()))
        def save():
            updated = dict(cfg,**{k:text(w) for k,w in widgets.items()})
            updated['minimo'],updated['maximo'] = float(updated['minimo']),float(updated['maximo'])
            import math
            if not math.isfinite(updated['minimo']) or not math.isfinite(updated['maximo']):
                raise ValueError('Escala inválida.')
            parsed = {}
            for row in schedules.toPlainText().splitlines():
                if row.strip():
                    k,v = row.split('=',1)
                    if not k.strip() or not v.strip():
                        raise ValueError('Cada horario debe indicar grupo=horario.')
                    parsed[k.strip()] = v.strip()
            if not parsed:
                raise ValueError('Configure al menos un turno.')
            if updated['logo']:
                from PIL import Image
                with Image.open(updated['logo']) as image:
                    image.verify()
            updated['horarios'] = parsed
            self.store.save_settings(updated)
        self.dialog('Configuración institucional',[(label,widgets[k]) for k,label in keys]+[('Turnos: una línea grupo=horario',schedules)],save)

    def edit_course(self, ident=None):
        row = self.store.rows('SELECT * FROM courses WHERE id=?',(ident,))[0] if ident else {}
        name = line(row.get('nombre',''))
        category = combo([(c,c) for c in CATEGORIES])
        category.setCurrentText(row.get('categoria',CATEGORIES[0]))
        active = QCheckBox('Curso activo')
        active.setChecked(bool(row.get('activo',1)))
        self.dialog('Catálogo de cursos',[('Nombre',name),('Categoría',category),('',active)],lambda:self.store.course(text(name),text(category),active.isChecked(),ident))

    def create_backup(self):
        folder = QFileDialog.getExistingDirectory(self,'Carpeta para respaldo (preferiblemente otro dispositivo)')
        if not folder:
            return
        import os
        if os.stat(folder).st_dev == os.stat(self.store.root).st_dev:
            if QMessageBox.warning(self,'Mismo dispositivo','El destino está en el mismo dispositivo. Si se pierde o falla, puede perder ambas copias. ¿Continuar?',QMessageBox.Yes|QMessageBox.No)!=QMessageBox.Yes:
                return
        result = backup(self.store,folder)
        QMessageBox.information(self,'Respaldo verificado',str(result))

    def restore_backup(self):
        path,_ = QFileDialog.getOpenFileName(self,'Seleccionar respaldo CEICOM','','Respaldo (*.zip)')
        if not path:
            return
        if QMessageBox.warning(self,'Restaurar datos','Esto reemplazará estudiantes, notas e informes actuales. Se validará el respaldo y se creará una copia previa. ¿Continuar?',QMessageBox.Yes|QMessageBox.No)!=QMessageBox.Yes:
            return
        recovery = restore(self.store,path,confirmed=True)
        self.refresh()
        QMessageBox.information(self,'Restauración completada',f'Copia previa conservada en:\n{recovery}')

    def refresh(self):
        self.refresh_students()
        rows = self.store.enrollments()
        self.fill(self.enrollment_table,rows,['id','estudiante','curso','categoria','turno','horario','fecha_ingreso','estado','fecha_fin'])
        self.refresh_grades()
        self.refresh_history()
        self.fill(self.courses_table,self.store.rows('SELECT * FROM courses ORDER BY categoria,nombre'),['id','nombre','categoria','activo'])
        students = self.store.db.execute('SELECT count(*) FROM students').fetchone()[0]
        active = sum(r['estado']=='activo' for r in rows)
        pending = sum(r['grade_id'] is not None and r['report_id'] is None for r in rows)
        missing = sum(r['grade_id'] is None for r in rows)
        reports = self.store.db.execute("SELECT count(*) FROM reports WHERE estado!='borrador' AND substr(confirmado_at,1,7)=?",(date.today().strftime('%Y-%m'),)).fetchone()[0]
        self.cards.setText(f'{students} estudiantes    ·    {active} inscripciones activas\n\n{pending} notas pendientes de entrega    ·    {missing} sin nota\n\n{reports} informes cerrados este mes')
        self.pending_table.setRowCount(0)
