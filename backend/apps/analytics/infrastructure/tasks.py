import json
from pathlib import Path
from uuid import uuid4

from celery import shared_task
from django.conf import settings
from openpyxl import Workbook
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.legends import Legend
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.shapes import Drawing, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from ..application.queries import DashboardQuery, SalesReportQuery

CHART_COLORS = (
    colors.HexColor("#0a0a0a"),
    colors.HexColor("#4a4a4a"),
    colors.HexColor("#6a6a6a"),
    colors.HexColor("#8a8a8a"),
    colors.HexColor("#aaaaaa"),
    colors.HexColor("#cacaca"),
    colors.HexColor("#dadada"),
)

MONTH_LABELS = {
    "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr", "05": "May", "06": "Jun",
    "07": "Jul", "08": "Ago", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
}


def _month_label(month):
    return MONTH_LABELS.get(month.split("-")[-1], month)


@shared_task
def generate_report(report_type, output_format="xlsx", filters=None):
    report_dir = Path(settings.MEDIA_ROOT) / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{report_type}-{uuid4().hex}.{output_format}"
    output_path = report_dir / filename

    CUSTOMER_REPORTS = {"customers", "customer_geo", "international_customers"}
    if report_type in CUSTOMER_REPORTS:
        sales_data = SalesReportQuery().execute()
        if output_format == "pdf":
            _write_customer_report_pdf(output_path, report_type, sales_data)
        else:
            if report_type == "customers":
                _write_customers_xlsx(output_path, sales_data)
            elif report_type == "customer_geo":
                _write_customer_geo_xlsx(output_path, sales_data)
            else:
                _write_international_customers_xlsx(output_path, sales_data)
    else:
        data = DashboardQuery().execute()
        if output_format == "pdf":
            _write_pdf(output_path, report_type, data)
        else:
            _write_xlsx(output_path, report_type, data)

    return {
        "report_type": report_type,
        "filters": filters or {},
        "status": "generated",
        "url": f"{settings.MEDIA_URL}reports/{filename}",
    }


def _fmt_cop(value):
    try:
        return f"$ {float(value):,.0f}".replace(",", ".")
    except (TypeError, ValueError):
        return str(value)


def _xlsx_header_style():
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    font = Font(bold=True, color="FFFFFF", size=10)
    fill = PatternFill("solid", fgColor="1A1A1A")
    alignment = Alignment(horizontal="center", vertical="center")
    thin = Side(style="thin", color="CCCCCC")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    return font, fill, alignment, border


def _xlsx_row_style(even):
    from openpyxl.styles import PatternFill, Alignment, Border, Side
    fill = PatternFill("solid", fgColor="F5F5F4" if even else "FFFFFF")
    alignment = Alignment(vertical="center")
    thin = Side(style="thin", color="E7E5E4")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    return fill, alignment, border


def _apply_header(sheet, headers):
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    font, fill, alignment, border = _xlsx_header_style()
    sheet.row_dimensions[1].height = 20
    for col_idx, header in enumerate(headers, 1):
        cell = sheet.cell(row=1, column=col_idx, value=header)
        cell.font = font
        cell.fill = fill
        cell.alignment = alignment
        cell.border = border


def _apply_row(sheet, row_idx, values):
    fill, alignment, border = _xlsx_row_style(row_idx % 2 == 0)
    for col_idx, value in enumerate(values, 1):
        cell = sheet.cell(row=row_idx, column=col_idx, value=value)
        cell.fill = fill
        cell.alignment = alignment
        cell.border = border


def _write_customers_xlsx(path, data):
    from openpyxl.styles import Font
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Clientes activos"

    headers = ["#", "Nombre", "Email", "Ciudad", "Pedidos", "Ingresos", "Ticket promedio", "Última compra", "Segmento", "Modo"]
    _apply_header(sheet, headers)

    segment_map = {"VIP": "★ VIP", "Recurrente": "Recurrente", "Nuevo": "Nuevo", "Inactivo": "Inactivo"}
    mode_map = {"WHOLESALE": "Mayorista", "RETAIL": "Retail"}

    for i, c in enumerate(data.get("top_customers", []), 1):
        last_order = ""
        if c.get("last_order"):
            try:
                from datetime import datetime
                last_order = datetime.fromisoformat(c["last_order"]).strftime("%d/%m/%Y")
            except Exception:
                last_order = c["last_order"]
        values = (
            i, c["name"], c["email"], c["city"] or "—",
            c["orders"], _fmt_cop(c["revenue"]), _fmt_cop(c["avg_ticket"]),
            last_order, segment_map.get(c["segment"], c["segment"]),
            mode_map.get(c["mode"], c["mode"]),
        )
        _apply_row(sheet, i + 1, values)
        if c["segment"] == "VIP":
            sheet.cell(row=i + 1, column=9).font = Font(bold=True, color="B45309")

    _auto_width(sheet)

    # hoja de segmentación
    seg_sheet = workbook.create_sheet("Segmentación")
    _apply_header(seg_sheet, ["Segmento", "Cantidad", "Porcentaje"])
    for i, s in enumerate(data.get("customer_segments", []), 1):
        _apply_row(seg_sheet, i + 1, (s["segment"], s["count"], f"{s['percentage']}%"))
    _auto_width(seg_sheet)

    workbook.save(path)


def _write_customer_geo_xlsx(path, data):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Distribución geográfica"

    headers = ["#", "Ciudad", "Clientes", "Pedidos", "Ingresos totales", "% de la base"]
    _apply_header(sheet, headers)

    for i, g in enumerate(data.get("customer_geo", []), 1):
        _apply_row(sheet, i + 1, (
            i, g["city"], g["customers"], g["orders"],
            _fmt_cop(g["revenue"]), f"{g['percentage']}%",
        ))

    _auto_width(sheet)
    workbook.save(path)


def _write_international_customers_xlsx(path, data):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Clientes internacionales"

    headers = ["#", "Nombre", "Email", "País(es)", "Pedidos", "Ingresos", "Modo", "Distribuidor"]
    _apply_header(sheet, headers)

    mode_map = {"WHOLESALE": "Mayorista", "RETAIL": "Retail"}
    for i, c in enumerate(data.get("international_customers", []), 1):
        _apply_row(sheet, i + 1, (
            i, c["name"], c["email"],
            ", ".join(c["countries"]),
            c["orders"], _fmt_cop(c["revenue"]),
            mode_map.get(c["mode"], c["mode"]),
            "Sí" if c["is_distributor"] else "No",
        ))

    _auto_width(sheet)
    workbook.save(path)


def _auto_width(sheet):
    for col in sheet.columns:
        max_len = max((len(str(cell.value or "")) for cell in col), default=10)
        sheet.column_dimensions[col[0].column_letter].width = min(max_len + 4, 50)


def _pdf_table_style():
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a1a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f5f4")]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d6d3d1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ])


def _write_customer_report_pdf(path, report_type, data):
    from datetime import date
    document = SimpleDocTemplate(
        str(path), pagesize=letter,
        topMargin=40, bottomMargin=36, leftMargin=36, rightMargin=36,
    )
    styles = getSampleStyleSheet()
    title_style = styles["Title"]
    h2_style = styles["Heading2"]
    normal = styles["Normal"]
    normal.fontSize = 8

    TITLES = {
        "customers": "Reporte de Clientes Activos",
        "customer_geo": "Reporte de Distribución Geográfica",
        "international_customers": "Reporte de Clientes Internacionales",
    }

    elements = [
        Paragraph("Juhnios Rold", title_style),
        Paragraph(TITLES.get(report_type, "Reporte de Clientes"), h2_style),
        Paragraph(f"Generado el {date.today().strftime('%d/%m/%Y')}", normal),
        Spacer(1, 16),
    ]

    mode_map = {"WHOLESALE": "Mayorista", "RETAIL": "Retail"}

    if report_type == "customers":
        # Segmentación summary
        segments = data.get("customer_segments", [])
        if segments:
            elements.append(Paragraph("Segmentación de clientes", h2_style))
            elements.append(Spacer(1, 6))
            seg_rows = [["Segmento", "Cantidad", "Porcentaje"]] + [
                [s["segment"], str(s["count"]), f"{s['percentage']}%"]
                for s in segments
            ]
            seg_table = Table(seg_rows, colWidths=[7 * cm, 4 * cm, 4 * cm])
            seg_table.setStyle(_pdf_table_style())
            elements += [seg_table, Spacer(1, 20)]

        customers = data.get("top_customers", [])
        if customers:
            elements.append(Paragraph("Detalle de clientes activos", h2_style))
            elements.append(Spacer(1, 6))
            rows = [["#", "Nombre", "Ciudad", "Pedidos", "Ingresos", "Ticket prom.", "Segmento", "Modo"]]
            for i, c in enumerate(customers, 1):
                rows.append([
                    str(i), c["name"][:22], c["city"] or "—",
                    str(c["orders"]), _fmt_cop(c["revenue"]), _fmt_cop(c["avg_ticket"]),
                    c["segment"], mode_map.get(c["mode"], c["mode"]),
                ])
            col_widths = [1 * cm, 5 * cm, 3 * cm, 1.8 * cm, 3 * cm, 3 * cm, 2.5 * cm, 2.5 * cm]
            table = Table(rows, colWidths=col_widths, repeatRows=1)
            table.setStyle(_pdf_table_style())
            elements.append(table)

    elif report_type == "customer_geo":
        geo = data.get("customer_geo", [])
        if geo:
            elements.append(Paragraph("Top ciudades por ingresos", h2_style))
            elements.append(Spacer(1, 6))
            rows = [["#", "Ciudad", "Clientes", "Pedidos", "Ingresos totales", "% de la base"]]
            for i, g in enumerate(geo, 1):
                rows.append([str(i), g["city"], str(g["customers"]), str(g["orders"]),
                              _fmt_cop(g["revenue"]), f"{g['percentage']}%"])
            col_widths = [1 * cm, 5 * cm, 3 * cm, 3 * cm, 5 * cm, 3 * cm]
            table = Table(rows, colWidths=col_widths, repeatRows=1)
            table.setStyle(_pdf_table_style())
            elements.append(table)

    elif report_type == "international_customers":
        intl = data.get("international_customers", [])
        elements.append(Paragraph(f"Total: {len(intl)} cliente(s) internacionales detectado(s)", normal))
        elements.append(Spacer(1, 10))
        if intl:
            rows = [["#", "Nombre", "País(es)", "Pedidos", "Ingresos", "Modo", "Distribuidor"]]
            for i, c in enumerate(intl, 1):
                rows.append([
                    str(i), c["name"][:24], ", ".join(c["countries"]),
                    str(c["orders"]), _fmt_cop(c["revenue"]),
                    mode_map.get(c["mode"], c["mode"]),
                    "Sí" if c["is_distributor"] else "No",
                ])
            col_widths = [1 * cm, 5 * cm, 4 * cm, 2 * cm, 3.5 * cm, 2.5 * cm, 2.5 * cm]
            table = Table(rows, colWidths=col_widths, repeatRows=1)
            table.setStyle(_pdf_table_style())
            elements.append(table)
        else:
            elements.append(Paragraph("No se encontraron clientes internacionales.", normal))

    document.build(elements)


def _write_xlsx(path, report_type, data):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = report_type[:31]
    sheet.append(("Indicador", "Valor"))
    for key, value in data.items():
        sheet.append((key, json.dumps(value, default=str, ensure_ascii=False) if isinstance(value, (list, dict)) else value))
    workbook.save(path)


def _write_pdf(path, report_type, data):
    document = canvas.Canvas(str(path), pagesize=letter)
    document.setTitle(f"Reporte {report_type}")
    document.drawString(50, 750, f"Juhnios Rold - Reporte {report_type}")
    y = 720
    for key, value in data.items():
        text = f"{key}: {json.dumps(value, default=str, ensure_ascii=False)}"
        document.drawString(50, y, text[:100])
        y -= 22
        if y < 50:
            document.showPage()
            y = 750
    document.save()


@shared_task
def export_sales_report(output_format="xlsx"):
    data = SalesReportQuery().execute()
    report_dir = Path(settings.MEDIA_ROOT) / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    filename = f"reporte-ventas-{uuid4().hex}.{output_format}"
    output_path = report_dir / filename

    if output_format == "pdf":
        _write_sales_report_pdf(output_path, data)
    else:
        _write_sales_report_xlsx(output_path, data)

    return {
        "status": "generated",
        "url": f"{settings.MEDIA_URL}reports/{filename}",
    }


def _write_sales_report_xlsx(path, data):
    workbook = Workbook()

    sheet = workbook.active
    sheet.title = "Ventas mensuales"
    sheet.append(("Mes", "Ventas", "Pedidos"))
    for row in data["monthly_sales"]:
        sheet.append((_month_label(row["month"]), row["total"], row["orders"]))

    categories_sheet = workbook.create_sheet("Por categoría")
    categories_sheet.append(("Categoría", "Ventas"))
    for row in data["sales_by_category"]:
        categories_sheet.append((row["category"], row["total"]))

    products_sheet = workbook.create_sheet("Top productos")
    products_sheet.append(("Producto", "Unidades", "Ingresos"))
    for row in data["top_products"]:
        products_sheet.append((row["name"], row["units"], row["revenue"]))

    segments_sheet = workbook.create_sheet("Segmentación clientes")
    segments_sheet.append(("Segmento", "Cantidad", "Porcentaje"))
    for row in data["customer_segments"]:
        segments_sheet.append((row["segment"], row["count"], row["percentage"]))

    workbook.save(path)


def _line_chart_drawing(monthly_sales):
    drawing = Drawing(480, 220)
    chart = HorizontalLineChart()
    chart.x = 50
    chart.y = 30
    chart.width = 400
    chart.height = 160
    chart.data = [[float(row["total"]) for row in monthly_sales]]
    chart.categoryAxis.categoryNames = [_month_label(row["month"]) for row in monthly_sales]
    chart.categoryAxis.labels.fontSize = 8
    chart.valueAxis.labels.fontSize = 8
    chart.valueAxis.valueMin = 0
    chart.lines[0].strokeColor = colors.HexColor("#0a0a0a")
    chart.lines[0].strokeWidth = 2
    drawing.add(chart)
    drawing.add(String(50, 200, "Ventas mensuales ($)", fontSize=10))
    return drawing


def _pie_chart_drawing(sales_by_category):
    drawing = Drawing(480, 220)
    chart = Pie()
    chart.x = 80
    chart.y = 20
    chart.width = 150
    chart.height = 150
    chart.data = [float(row["total"]) for row in sales_by_category] or [1]
    categories = [row["category"] for row in sales_by_category] or ["Sin datos"]
    chart.labels = [""] * len(chart.data)
    chart.slices.strokeWidth = 0.5
    for index in range(len(chart.data)):
        chart.slices[index].fillColor = CHART_COLORS[index % len(CHART_COLORS)]
    drawing.add(chart)

    legend = Legend()
    legend.x = 280
    legend.y = 150
    legend.dx = 8
    legend.dy = 8
    legend.fontSize = 8
    legend.alignment = "left"
    legend.colorNamePairs = [
        (CHART_COLORS[index % len(CHART_COLORS)], name) for index, name in enumerate(categories)
    ]
    drawing.add(legend)
    drawing.add(String(80, 195, "Ventas por categoría", fontSize=10))
    return drawing


def _bar_chart_drawing(top_products):
    drawing = Drawing(480, 240)
    chart = VerticalBarChart()
    chart.x = 100
    chart.y = 40
    chart.width = 350
    chart.height = 160
    chart.data = [[float(row["units"]) for row in top_products]]
    chart.categoryAxis.categoryNames = [
        row["name"][:14] for row in top_products
    ]
    chart.categoryAxis.labels.fontSize = 7
    chart.categoryAxis.labels.angle = 30
    chart.categoryAxis.labels.dy = -10
    chart.valueAxis.labels.fontSize = 8
    chart.valueAxis.valueMin = 0
    chart.bars[0].fillColor = colors.HexColor("#0a0a0a")
    drawing.add(chart)
    drawing.add(String(100, 220, "Top 5 productos (unidades)", fontSize=10))
    return drawing


def _write_sales_report_pdf(path, data):
    document = SimpleDocTemplate(str(path), pagesize=letter, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    elements = [
        Paragraph("Juhnios Rold - Reporte de ventas", styles["Title"]),
        Spacer(1, 12),
    ]

    if data["monthly_sales"]:
        elements.append(_line_chart_drawing(data["monthly_sales"]))
        elements.append(Spacer(1, 16))

    if data["sales_by_category"]:
        elements.append(_pie_chart_drawing(data["sales_by_category"]))
        elements.append(Spacer(1, 16))

    if data["top_products"]:
        elements.append(_bar_chart_drawing(data["top_products"]))
        elements.append(Spacer(1, 16))

    elements.append(PageBreak())
    elements.append(Paragraph("Segmentación de clientes", styles["Heading2"]))
    elements.append(Spacer(1, 8))
    segment_rows = [["Segmento", "Cantidad", "Porcentaje"]] + [
        [row["segment"], str(row["count"]), f"{row['percentage']}%"]
        for row in data["customer_segments"]
    ]
    segment_table = Table(segment_rows, colWidths=[6 * cm, 4 * cm, 4 * cm])
    segment_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#222222")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f2f2")]),
    ]))
    elements.append(segment_table)

    elements.append(Spacer(1, 20))
    elements.append(Paragraph("Top productos", styles["Heading2"]))
    elements.append(Spacer(1, 8))
    product_rows = [["Producto", "Unidades", "Ingresos"]] + [
        [row["name"], str(row["units"]), str(row["revenue"])]
        for row in data["top_products"]
    ]
    product_table = Table(product_rows, colWidths=[8 * cm, 3 * cm, 3 * cm])
    product_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#222222")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f2f2")]),
    ]))
    elements.append(product_table)

    document.build(elements)
