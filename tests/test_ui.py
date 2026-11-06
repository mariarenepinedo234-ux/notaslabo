import os
os.environ.setdefault('QT_QPA_PLATFORM','offscreen')
from PySide6.QtWidgets import QApplication
from ceicom.store import Store
from ceicom.demo import seed
from ceicom.ui import Window


def test_desktop_opens_and_lists_demo_data(tmp_path):
    app = QApplication.instance() or QApplication([])
    store = Store(tmp_path)
    seed(store)
    window = Window(store,demo=True)
    window.show()
    app.processEvents()
    assert window.tabs.count() == 7
    assert window.students_table.rowCount() == 2
    assert window.enrollment_table.rowCount() == 3
    assert window.grades_table.rowCount() == 3
    assert '3 notas pendientes' in window.cards.text()
    assert window.courses_table.rowCount() == 20
    window.close()
    store.db.close()


def test_history_combined_filters(tmp_path):
    app = QApplication.instance() or QApplication([])
    store = Store(tmp_path)
    seed(store)
    from ceicom.store import CATEGORIES
    for category in CATEGORIES:
        store.draft(category,'2026-11',[r['grade_id'] for r in store.pending(category,'2026-11')])
    window = Window(store)
    assert window.history_table.rowCount() == 2
    window.history_category.setCurrentText(CATEGORIES[1])
    window.history_year.setText('2026')
    window.history_month.setCurrentText('11')
    window.history_state.setCurrentText('borrador')
    app.processEvents()
    assert window.history_table.rowCount() == 1
    window.history_year.setText('2027')
    assert window.history_table.rowCount() == 0
    window.close()
    store.db.close()
