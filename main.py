"""Inicio de escritorio con diagnóstico visible, también en el EXE sin consola."""
import logging
import sys
import tempfile
from pathlib import Path


def _startup_logger():
    path = Path(tempfile.gettempdir()) / 'CEICOM_aplicacion.log'
    logger = logging.getLogger('ceicom.startup')
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        try:
            logger.addHandler(logging.FileHandler(path, encoding='utf-8'))
        except OSError:
            logger.addHandler(logging.NullHandler())
    return logger, path


def _show_error(app, message):
    # Si Qt no se pudo importar, el cuadro nativo de Windows sigue disponible.
    if app is not None:
        from PySide6.QtWidgets import QMessageBox
        QMessageBox.critical(None, 'CEICOM · Inicio', message)
    elif sys.platform == 'win32':
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, message, 'CEICOM · No se pudo iniciar', 0x10)
    elif sys.stderr:
        print(message, file=sys.stderr)


def main():
    logger, log_path = _startup_logger()
    app = store = lock = None
    acquired = False
    try:
        # Los errores de importación también deben quedar registrados.
        from PySide6.QtWidgets import QApplication
        from PySide6.QtCore import QLockFile
        from ceicom.paths import app_home
        from ceicom.store import Store
        from ceicom.ui import Window
        app = QApplication.instance() or QApplication(sys.argv)
        app.setApplicationName('CEICOM')
        app.setOrganizationName('CEICOM')
        root = app_home()
        lock = QLockFile(str(root / 'datos/ceicom.lock'))
        lock.setStaleLockTime(30000)
        acquired = lock.tryLock(100)
        if not acquired:
            raise RuntimeError('Ya existe otra instancia usando esta carpeta de datos.')
        store = Store(root)
        if '--demo' in sys.argv:
            from ceicom.demo import seed
            seed(store)
        window = Window(store, demo='--demo' in sys.argv)
        window.show()
        logger.info('Ventana CEICOM abierta correctamente.')
        smoke_test = '--comprobar-inicio' in sys.argv
        if smoke_test:
            from PySide6.QtCore import QTimer
            QTimer.singleShot(250, app.quit)
        result = app.exec()
        if smoke_test and result == 0:
            if window.tabs.count() != 7:
                raise RuntimeError('No se cargaron todas las pantallas.')
            (root / 'datos/inicio_verificado.txt').write_text('Interfaz y siete pantallas cargadas correctamente.', encoding='utf-8')
        return result
    except Exception as error:
        logger.exception('Error al iniciar CEICOM')
        if '--comprobar-inicio' in sys.argv:
            return 1
        _show_error(app, f'No se pudo iniciar CEICOM:\n{error}\n\nRegistro de diagnóstico:\n{log_path}\n\nSi el USB es de solo lectura, configure CEICOM_HOME en una carpeta escribible.')
        return 1
    finally:
        if store is not None:
            store.db.close()
        if acquired:
            lock.unlock()


if __name__ == '__main__':
    sys.exit(main())
