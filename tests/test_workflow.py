import hashlib
import sqlite3
import zipfile
import pytest
from openpyxl import load_workbook
from pypdf import PdfReader
from ceicom.store import Store, CATEGORIES
from ceicom.exports import export_report
from ceicom.backup import backup, restore, validate


@pytest.fixture
def school(tmp_path):
    s = Store(tmp_path)
    juan = s.student('Juan','Ejemplo')
    maria = s.student('María','Ficticia')
    courses = {r['nombre']:r['id'] for r in s.rows('SELECT * FROM courses')}
    grades = {}
    for student,course,shift,score in [(juan,'Illustrator','Mañana',80),(juan,'Photoshop','Tarde',0),(maria,'Power BI','Noche',95)]:
        e = s.enroll(student,courses[course],shift,'2026-10-01','Lunes, miércoles y viernes')
        grades[course] = s.grade(e,score,'2026-10')
    yield s,grades,juan
    s.db.close()


def deliver(s, ids, category=CATEGORIES[0]):
    r = s.draft(category,'2026-11',ids)
    s.confirm(r,'Docente de prueba','2026-11-04',explicit=True)
    return r


def test_catalog_seed_once(tmp_path):
    s = Store(tmp_path)
    assert len(s.rows('SELECT * FROM courses')) == 20
    s.db.close()
    s = Store(tmp_path)
    assert len(s.rows('SELECT * FROM courses')) == 20
    s.db.close()


def test_preview_does_not_deliver_and_courses_are_independent(school):
    s,g,_ = school
    r = s.draft(CATEGORIES[0],'2026-11',[g['Illustrator']])
    assert len(s.pending(CATEGORIES[0],'2026-12')) == 2
    with pytest.raises(ValueError):
        s.confirm(r,'Docente','2026-11-04')
    s.confirm(r,'Docente','2026-11-04',explicit=True)
    assert [i['curso'] for i in s.pending(CATEGORIES[0],'2026-12')] == ['Photoshop']
    assert s.pending(CATEGORIES[1],'2026-12')[0]['curso'] == 'Power BI'
    assert s.report(r)['contenido']['filas'][0]['periodo'] == '2026-10'
    assert s.report(r)['contenido']['fecha_presentacion'] == '2026-11-04'


def test_category_empty_and_future_rejected(school):
    s,g,_ = school
    assert not s.pending(CATEGORIES[0],'2026-09')
    for ids in ([],[g['Power BI']],[g['Illustrator'],g['Power BI']]):
        with pytest.raises(ValueError):
            s.draft(CATEGORIES[0],'2026-11',ids)


def test_zero_missing_scale_and_edit_delivered(school):
    s,g,juan = school
    assert next(r for r in s.enrollments() if r['curso']=='Photoshop')['valor'] == 0
    course = s.rows("SELECT id FROM courses WHERE nombre='Python'")[0]['id']
    e = s.enroll(juan,course,'Noche','2026-11-01')
    assert next(r for r in s.enrollments() if r['id']==e)['valor'] is None
    for score in (-1,101,float('nan'),float('inf'),''):
        with pytest.raises(ValueError):
            s.grade(e,score,'2026-11')
    r = deliver(s,[g['Illustrator']])
    enrollment = s.report(r)['contenido']['filas'][0]['id']
    with pytest.raises(ValueError):
        s.grade(enrollment,88,'2026-10')


def test_stale_preview_and_double_close_are_atomic(school):
    s,g,_ = school
    first = s.draft(CATEGORIES[0],'2026-11',[g['Illustrator']])
    second = s.draft(CATEGORIES[0],'2026-11',[g['Illustrator'],g['Photoshop']])
    s.confirm(first,'Docente','2026-11-04',explicit=True)
    with pytest.raises(ValueError):
        s.confirm(second,'Docente','2026-11-04',explicit=True)
    assert s.report(second)['estado'] == 'borrador'
    assert len(s.pending(CATEGORIES[0],'2026-12')) == 1
    with pytest.raises(ValueError):
        s.confirm(first,'Docente','2026-11-04',explicit=True)


def test_changed_data_requires_new_preview(school):
    s,g,juan = school
    r = s.draft(CATEGORIES[0],'2026-11',[g['Illustrator']])
    s.student('Juan editado','Ejemplo',ident=juan)
    with pytest.raises(ValueError,match='cambiaron'):
        s.confirm(r,'Docente','2026-11-04',explicit=True)
    assert len(s.pending(CATEGORIES[0],'2026-11')) == 2


def test_snapshot_versions_and_byte_exact_reexport(school):
    s,g,juan = school
    r = deliver(s,[g['Illustrator']])
    before = s.report(r)['snapshot']
    paths = export_report(s,r)
    original_bytes = [p.read_bytes() for p in paths]
    s.student('Nombre posterior','Cambiado',ident=juan)
    assert s.report(r)['snapshot'] == before
    assert [p.read_bytes() for p in export_report(s,r)] == original_bytes
    new = s.rectify(r,{str(g['Illustrator']):91},'Corrección documentada','Docente','2027-01-04',explicit=True)
    assert s.report(new)['version'] == 2
    assert s.report(new)['parent_id'] == r
    assert s.report(new)['contenido']['filas'][0]['valor'] == 91
    assert s.report(r)['snapshot'] == before
    assert len(s.pending(CATEGORIES[0],'2027-01')) == 1
    with pytest.raises(ValueError):
        s.rectify(r,{str(g['Illustrator']):92},'otra','Docente','2027-01-05',explicit=True)
    with pytest.raises(sqlite3.IntegrityError):
        with s.db:
            s.db.execute('UPDATE reports SET snapshot=? WHERE id=?',('{}',r))


def test_pdf_xlsx_content_and_regeneration(school):
    s,g,_ = school
    r = deliver(s,[g['Power BI']],CATEGORIES[1])
    pdf,xlsx = export_report(s,r)
    reader = PdfReader(pdf)
    content = '\n'.join(page.extract_text() for page in reader.pages)
    assert 'Power BI' in content and '2026-11-04' in content and '2026-10' in content
    assert 'Illustrator' not in content
    wb = load_workbook(xlsx)
    assert wb.active['E9'].value == 95
    assert wb.active['D9'].value == 'Power BI'
    assert wb.active.print_title_rows == '$1:$8'
    pdf.unlink()
    xlsx.unlink()
    export_report(s,r)
    assert pdf.exists() and xlsx.exists()


def test_pagination_turnos_and_long_observations(school):
    s,g,juan = school
    course = s.rows("SELECT id FROM courses WHERE nombre='Illustrator'")[0]['id']
    ids = [g['Illustrator']]
    for i in range(65):
        student = s.student(f'Estudiante {i}','Prueba')
        e = s.enroll(student,course,'Mañana' if i%2 else 'Noche','2026-10-01')
        ids.append(s.grade(e,75,'2026-10','Observación de ejemplo '*4))
    r = deliver(s,ids)
    pdf,xlsx = export_report(s,r)
    reader = PdfReader(pdf)
    assert len(reader.pages) >= 3
    for page in reader.pages:
        assert 'Estudiante' in page.extract_text()
    assert load_workbook(xlsx).active['E9'].value is not None


def test_excel_formula_is_text(school):
    s,g,juan = school
    s.student('=HYPERLINK("x")','Prueba',ident=juan)
    r = deliver(s,[g['Illustrator']])
    _,xlsx = export_report(s,r)
    cell = load_workbook(xlsx).active['B9']
    assert cell.data_type == 's'


def test_backup_restore_integrity_and_no_silent_restore(school,tmp_path):
    s,g,_ = school
    report = deliver(s,[g['Illustrator']])
    paths = export_report(s,report)
    expected = [p.read_bytes() for p in paths]
    b = backup(s,tmp_path/'copies')
    assert validate(b)
    s.student('Posterior','Al respaldo')
    with pytest.raises(ValueError):
        restore(s,b)
    recovery = restore(s,b,confirmed=True)
    assert recovery.exists()
    assert len(s.rows('SELECT * FROM students')) == 2
    assert [p.read_bytes() for p in export_report(s,report)] == expected
    with zipfile.ZipFile(b,'a') as archive:
        archive.writestr('Informes/extra.txt','intruso')
    with pytest.raises(ValueError):
        restore(s,b,confirmed=True)
    assert len(s.rows('SELECT * FROM students')) == 2


def test_duplicate_and_deliberate_reenrollment(school):
    s,g,juan = school
    course = s.rows("SELECT id FROM courses WHERE nombre='Illustrator'")[0]['id']
    with pytest.raises(ValueError):
        s.enroll(juan,course,'Tarde','2026-11-01')
    assert s.enroll(juan,course,'Tarde','2026-11-01',deliberate=True)
