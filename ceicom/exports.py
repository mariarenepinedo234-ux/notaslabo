"""Documentos institucionales generados exclusivamente desde instantáneas."""
import base64
import io
import os
from pathlib import Path
from itertools import groupby
from xml.sax.saxutils import escape

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.pagebreak import Break
import reportlab
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image

HEADERS = ['N°', 'Estudiante', 'Ingreso', 'Curso individual', 'Nota', 'Mes de nota', 'Turno', 'Observaciones']
BURGUNDY = '781D3B'
# Fuente incluida en ReportLab: PDF legible sin fuentes instaladas en el equipo.
FONT_ROOT = Path(reportlab.__file__).parent / 'fonts'
pdfmetrics.registerFont(TTFont('CEICOM', str(FONT_ROOT / 'Vera.ttf')))
pdfmetrics.registerFont(TTFont('CEICOM-Bold', str(FONT_ROOT / 'VeraBd.ttf')))
pdfmetrics.registerFontFamily('CEICOM', normal='CEICOM', bold='CEICOM-Bold', italic='CEICOM', boldItalic='CEICOM-Bold')


def table_rows(rows):
    return [[i, r['estudiante'], r['fecha_ingreso'], r['curso'], r['valor'], r['periodo'], r['turno'], r['observacion']] for i, r in enumerate(rows, 1)]


def text_cell(ws, row, col, value):
    c = ws.cell(row, col, value)
    if isinstance(value, str):
        c.data_type = 's'  # Nombres/observaciones nunca se interpretan como fórmulas.
    return c


def export_report(store, ident):
    r = store.report(ident)
    snap = r['contenido']
    cfg = snap['encabezado']
    root = store.root / 'Informes' / snap['periodo'][:4] / snap['periodo'][5:]
    root.mkdir(parents=True, exist_ok=True)
    stem = f"CEICOM_{'DG' if r['categoria']=='Diseño Gráfico' else 'PS'}_{r['periodo']}_I{ident:06d}_v{r['version']}"
    if r['estado'] == 'borrador':
        stem += '_BORRADOR'
    pdf, xlsx = root / (stem + '.pdf'), root / (stem + '.xlsx')
    # Los originales archivados se conservan byte por byte al reexportar.
    if pdf.exists() and xlsx.exists():
        return pdf, xlsx
    title = f"Planilla de notas · {snap['categoria']}"
    reference = f"Informe {ident:06d} · Versión {r['version']} · {r['estado'].upper()}"
    delivery = snap.get('fecha_presentacion', 'SIN CONFIRMAR')
    intro = f"Mediante el presente informe se remiten las calificaciones de {snap['categoria']} para el período del informe {snap['periodo']}. Los meses académicos de cada nota se detallan en la planilla."
    styles = getSampleStyleSheet()
    for style in styles.byName.values():
        style.fontName = 'CEICOM-Bold' if style.name in ('Title','Heading2') else 'CEICOM'
    styles['Title'].textColor = colors.HexColor('#' + BURGUNDY)
    styles['Normal'].fontSize = 9
    styles['Normal'].leading = 12
    def p(value, style='Normal'):
        return Paragraph(escape(str(value)).replace('\n', '<br/>'), styles[style])
    story = []
    grouped = [(shift,list(rows)) for shift,rows in groupby(sorted(snap['filas'], key=lambda row:(row['turno'],row['curso'],row['estudiante'])), key=lambda row:row['turno'])]
    for index, (shift, rows) in enumerate(grouped):
        if index:
            story.append(PageBreak())
        if cfg.get('logo_base64'):
            story.append(Image(io.BytesIO(base64.b64decode(cfg['logo_base64'])), width=55, height=40, kind='proportional'))
        story.extend([p(cfg['institucion'], 'Title'), p(title, 'Heading2'), p(reference), p(f"Mes académico: {snap['periodo']} | Fecha de entrega: {delivery}"), Spacer(1,10), p(f"Señor/a: {cfg.get('destinatario') or '____________________'}"), p(cfg.get('cargo_destinatario','')), p('Presente. —'), Spacer(1,8), p('De mi consideración:'), p(intro), Spacer(1,8), p(f"Turno / grupo: {shift}"), p('Horario: ' + '; '.join(sorted({row.get('horario') or cfg.get('horarios',{}).get(shift,'') for row in rows}))), Spacer(1,10)])
        data = [[p(h) for h in HEADERS]] + [[p(v) for v in row] for row in table_rows(rows)]
        table = Table(data, colWidths=[26,168,70,130,42,70,75,155], repeatRows=1, hAlign='LEFT')
        table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#F2D56B')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F4F4F5')]),('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,0),1,colors.HexColor('#'+BURGUNDY)),('GRID',(0,1),(-1,-1),0.25,colors.HexColor('#DDDDDD'))]))
        story.extend([table, Spacer(1,10), p(f"Total de calificaciones: {len(rows)}"), p('Rectificación: '+snap['rectificacion']) if snap.get('rectificacion') else Spacer(1,1), Spacer(1,25), p(cfg.get('firma') or '________________________________'), p(cfg.get('docente') or 'Nombre del docente: ____________________'), p(cfg.get('cargo_docente',''))])
    def footer(canvas, doc):
        canvas.setFont('CEICOM',8)
        canvas.setFillColor(colors.HexColor('#'+BURGUNDY))
        canvas.drawString(28,20,reference)
        canvas.drawRightString(764,20,f'Página {doc.page}')
    tmp_pdf = pdf.with_suffix('.pdf.tmp')
    SimpleDocTemplate(str(tmp_pdf),pagesize=landscape(letter),rightMargin=28,leftMargin=28,topMargin=24,bottomMargin=35, invariant=1).build(story,onFirstPage=footer,onLaterPages=footer)
    wb = Workbook()
    ws = wb.active
    ws.title = 'Calificaciones'
    meta = [cfg['institucion'],title,reference,f"Mes académico: {snap['periodo']} | Fecha de entrega: {delivery}",f"Destinatario: {cfg.get('destinatario','')} · {cfg.get('cargo_destinatario','')}",intro]
    for n, value in enumerate(meta,1):
        text_cell(ws,n,1,value)
        ws.merge_cells(start_row=n,start_column=1,end_row=n,end_column=8)
    for col,h in enumerate(HEADERS,1):
        c = text_cell(ws,8,col,h)
        c.fill = PatternFill('solid',fgColor=BURGUNDY)
        c.font = Font(color='FFFFFF',bold=True)
    row_number = 9
    for shift, rows in grouped:
        if row_number > 9:
            ws.row_breaks.append(Break(id=row_number-1))
        for row in table_rows(rows):
            for col,value in enumerate(row,1):
                c = text_cell(ws,row_number,col,value)
                c.alignment = Alignment(wrap_text=True,vertical='top')
                if row_number % 2:
                    c.fill = PatternFill('solid',fgColor='F2F2F2')
            ws.row_dimensions[row_number].height = 32
            row_number += 1
    for value in [f"Total: {len(snap['filas'])}",f"Docente: {cfg.get('docente','')} · {cfg.get('cargo_docente','')}",cfg.get('firma',''),snap.get('rectificacion','')]:
        text_cell(ws,row_number+1,1,value)
        row_number += 1
    for col,width in zip('ABCDEFGH',[6,32,15,27,9,16,16,40]):
        ws.column_dimensions[col].width = width
    ws.freeze_panes = 'B9'
    ws.auto_filter.ref = f'A8:H{8+len(snap["filas"])}'
    ws.print_title_rows = '1:8'
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.paperSize = ws.PAPERSIZE_LETTER
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.oddFooter.center.text = 'Página &P de &N'
    tmp_xlsx = xlsx.with_suffix('.xlsx.tmp')
    wb.save(tmp_xlsx)
    if not pdf.exists():
        os.replace(tmp_pdf, pdf)
    else:
        tmp_pdf.unlink()
    if not xlsx.exists():
        os.replace(tmp_xlsx, xlsx)
    else:
        tmp_xlsx.unlink()
    return pdf, xlsx
