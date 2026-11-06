"""Fallos de arranque visibles; pruebas nativas BAT se ejecutan en Windows."""
import builtins
import logging
import os
from pathlib import Path
import shutil
import subprocess
import sys
import pytest
import main


def test_missing_qt_is_reported_and_logged(tmp_path, monkeypatch):
    path = tmp_path / 'inicio.log'
    logger = logging.Logger('test-startup')
    handler = logging.FileHandler(path, encoding='utf-8')
    logger.addHandler(handler)
    monkeypatch.setattr(main, '_startup_logger', lambda: (logger, path))
    messages = []
    monkeypatch.setattr(main, '_show_error', lambda app, message: messages.append((app, message)))
    real_import = builtins.__import__
    def missing_qt(name, *args, **kwargs):
        if name == 'PySide6.QtWidgets':
            raise ImportError('Biblioteca Qt ausente')
        return real_import(name, *args, **kwargs)
    monkeypatch.setattr(builtins, '__import__', missing_qt)
    try:
        assert main.main() == 1
        handler.flush()
        assert messages[0][0] is None
        assert 'Biblioteca Qt ausente' in messages[0][1]
        assert str(path) in messages[0][1]
        assert 'ImportError' in path.read_text(encoding='utf-8')
    finally:
        handler.close()


def test_unwritable_data_folder_shows_error(tmp_path, monkeypatch):
    os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
    from PySide6.QtWidgets import QApplication
    from ceicom import paths
    app = QApplication.instance() or QApplication([])
    messages = []
    monkeypatch.setattr(main, '_show_error', lambda app, message: messages.append(message))
    def fail():
        raise PermissionError('USB de solo lectura')
    monkeypatch.setattr(paths, 'app_home', fail)
    assert main.main() == 1
    assert 'USB de solo lectura' in messages[0]
    assert 'CEICOM_HOME' in messages[0]


@pytest.mark.skipif(sys.platform != 'win32', reason='Requiere cmd.exe de Windows')
@pytest.mark.parametrize('script', ['iniciar_windows.bat', 'build_windows.bat'])
def test_windows_launcher_reports_missing_configured_python(tmp_path, script):
    project = tmp_path / 'carpeta con espacios'
    project.mkdir()
    source = Path(__file__).resolve().parent.parent
    shutil.copy2(source / script, project / script)
    shutil.copytree(source / 'windows', project / 'windows')
    (project / 'main.py').write_text('# Fuente presente para comprobar deteccion de Python')
    (project / 'requirements.txt').write_text('')
    empty_path = tmp_path / 'sin_python'
    empty_path.mkdir()
    env = dict(os.environ, CEICOM_PYTHON=str(empty_path / 'python_ausente.exe'), CEICOM_NO_PAUSE='1', TEMP=str(tmp_path))
    cmd = str(Path(os.environ['SystemRoot']) / 'System32/cmd.exe')
    result = subprocess.run(f'"{cmd}" /d /s /c ""{project / script}""', cwd=project, env=env, capture_output=True, timeout=20)
    output = result.stdout.decode(errors='replace')
    assert result.returncode == 1
    assert 'No se encontro Python 3.12' in output, result.stderr.decode(errors='replace')
    assert 'NO SE PUDO COMPLETAR' in output
    action = 'iniciar' if script.startswith('iniciar') else 'compilar'
    assert 'No se encontro Python 3.12' in (tmp_path / f'CEICOM_{action}.log').read_text(errors='replace')
