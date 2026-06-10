import json
from pathlib import Path
from uuid import uuid4

from celery import shared_task
from django.conf import settings
from openpyxl import Workbook
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from ..application.queries import DashboardQuery


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
