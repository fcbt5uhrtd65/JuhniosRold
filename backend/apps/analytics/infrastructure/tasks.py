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
    data = DashboardQuery().execute()
    report_dir = Path(settings.MEDIA_ROOT) / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{report_type}-{uuid4().hex}.{output_format}"
    output_path = report_dir / filename

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
