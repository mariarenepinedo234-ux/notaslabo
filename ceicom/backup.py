"""Respaldos consistentes, verificados y restauración con recuperación previa."""
from contextlib import closing
import hashlib
import json
import os
import shutil
import sqlite3
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from uuid import uuid4


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def backup(store, destination):
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / f'CEICOM_respaldo_{datetime.now():%Y%m%d_%H%M%S}_{uuid4().hex[:8]}.zip'
    with tempfile.TemporaryDirectory() as temp:
        stage = Path(temp)
        db_path = stage / 'datos/ceicom.sqlite3'
        db_path.parent.mkdir()
        with closing(sqlite3.connect(db_path)) as conn:
            store.db.backup(conn)
        shutil.copytree(store.root / 'Informes', stage / 'Informes')
        files = [p for p in stage.rglob('*') if p.is_file()]
        manifest = {p.relative_to(stage).as_posix():digest(p) for p in files}
        with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
            for p in files:
                archive.write(p,p.relative_to(stage).as_posix())
            archive.writestr('manifest.json',json.dumps(manifest))
    validate(target)
    return target


def validate(archive_path):
    with zipfile.ZipFile(archive_path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or 'manifest.json' not in names:
            raise ValueError('Respaldo incompleto o entradas duplicadas.')
        manifest = json.loads(archive.read('manifest.json'))
        if not isinstance(manifest,dict) or 'datos/ceicom.sqlite3' not in manifest or set(names) != set(manifest)|{'manifest.json'}:
            raise ValueError('Manifiesto inválido.')
        for name, expected in manifest.items():
            parts = Path(name).parts
            if '\\' in name or ':' in name or name.startswith('/') or '..' in parts or not (name == 'datos/ceicom.sqlite3' or name.startswith('Informes/')):
                raise ValueError('Ruta no permitida en el respaldo.')
            if hashlib.sha256(archive.read(name)).hexdigest() != expected:
                raise ValueError('Respaldo dañado: checksum incorrecto.')
        with tempfile.TemporaryDirectory() as temp:
            db = Path(temp)/'verify.sqlite3'
            db.write_bytes(archive.read('datos/ceicom.sqlite3'))
            with closing(sqlite3.connect(db)) as conn:
                if conn.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or conn.execute('PRAGMA foreign_key_check').fetchall():
                    raise ValueError('Base de datos dañada.')
                required = {'students','courses','grades','reports','report_items','enrollments','settings','audit_log'}
                actual = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                if not required <= actual:
                    raise ValueError('No es una base CEICOM compatible.')
                for sql in ('SELECT nombres,apellidos,active FROM students LIMIT 1','SELECT valor,periodo,report_id FROM grades LIMIT 1','SELECT snapshot,estado,version FROM reports LIMIT 1','SELECT value FROM settings WHERE id=1'):
                    conn.execute(sql).fetchall()
    return True


def restore(store, archive_path, confirmed=False):
    if not confirmed:
        raise ValueError('La restauración requiere confirmación expresa.')
    validate(archive_path)  # Validar antes de tocar datos o cerrar conexión.
    recovery = backup(store, store.root / 'RespaldosPrevios')
    with tempfile.TemporaryDirectory(dir=store.root) as temp:
        stage = Path(temp)
        with zipfile.ZipFile(archive_path) as archive:
            archive.extractall(stage)
        (stage / 'Informes').mkdir(exist_ok=True)
        store.db.close()
        old_reports = stage / 'previous_reports'
        old_db = stage / 'previous.sqlite3'
        db_path = store.root / 'datos/ceicom.sqlite3'
        reports = store.root / 'Informes'
        try:
            os.replace(db_path, old_db)
            os.replace(reports, old_reports)
            os.replace(stage / 'datos/ceicom.sqlite3', db_path)
            os.replace(stage / 'Informes', reports)
        except Exception:
            if old_db.exists():
                os.replace(old_db, db_path)
            if old_reports.exists():
                if reports.exists():
                    shutil.rmtree(reports)
                os.replace(old_reports,reports)
            raise
        finally:
            store.db = sqlite3.connect(db_path)
            store.db.row_factory = sqlite3.Row
            store.db.execute('PRAGMA foreign_keys=ON')
    return recovery
