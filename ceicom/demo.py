"""Datos explícitamente ficticios; solo se invoca con --demo en carpeta separada."""
def seed(store):
    if store.db.execute('SELECT 1 FROM students LIMIT 1').fetchone():
        return
    juan = store.student('Juan (FICTICIO)','Ejemplo')
    maria = store.student('María (FICTICIA)','Demostración')
    courses = {r['nombre']:r['id'] for r in store.rows('SELECT * FROM courses')}
    for student,course,shift,value in [(juan,'Illustrator','Mañana',85),(juan,'Photoshop','Tarde',0),(maria,'Power BI','Noche',92)]:
        enrollment = store.enroll(student,courses[course],shift,'2026-10-01',store.settings()['horarios'][shift])
        store.grade(enrollment,value,'2026-10','DEMOSTRACIÓN FICTICIA')
