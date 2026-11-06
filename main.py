"""Punto de entrada de escritorio y de PyInstaller."""
import sys
from ceicom.paths import app_home
from ceicom.store import Store


def main():
    from PySide6.QtWidgets import QApplication, QMessageBox
    from ceicom.ui import Window
    app = QApplication(sys.argv)
    app.setApplicationName('CEICOM')
    app.setOrganizationName('CEICOM')
    # Impide dos procesos escribiendo/restaurando la misma carpeta de datos.
    from PySide6.QtCore import QLockFile
    try:
        root = app_home()
        lock = QLockFile(str(root / 'datos/ceicom.lock'))
        lock.setStaleLockTime(30000)
        if not lock.tryLock(100):
            raise RuntimeError('Ya existe otra instancia usando esta carpeta de datos.')
        store = Store(root)
        if '--demo' in sys.argv:
            from ceicom.demo import seed
            seed(store)
        window = Window(store,demo='--demo' in sys.argv)
        window.show()
        result = app.exec()
        store.db.close()
        lock.unlock()
        return result
    except Exception as e:
        QMessageBox.critical(None,'CEICOM · Inicio',f'No se pudo iniciar: {e}\nSi el USB es de solo lectura, configure CEICOM_HOME en una carpeta escribible.')
        return 1


if __name__ == '__main__':
    sys.exit(main())
