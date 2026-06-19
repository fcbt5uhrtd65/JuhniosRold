import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def render_invoice_pdf(invoice):
    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=36,
        bottomMargin=36,
        title=f"Factura {invoice.number}",
    )
    styles = getSampleStyleSheet()
    elements = [
        Paragraph("Juhnios Rold", styles["Title"]),
        Paragraph(f"Factura de venta {invoice.number}", styles["Heading2"]),
        Spacer(1, 12),
    ]

    info_rows = [
        ["Pedido", invoice.order.number],
        ["Fecha de emisión", invoice.issued_at.strftime("%Y-%m-%d %H:%M")],
        ["Estado", invoice.get_status_display()],
        ["Cliente", invoice.customer_name],
        ["Documento", invoice.customer_document],
        ["Email", invoice.customer_email],
        ["Dirección de facturación", invoice.billing_address or "-"],
    ]
    info_table = Table(info_rows, colWidths=[5 * cm, 11 * cm])
    info_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 16))

    elements.append(Paragraph("Detalle", styles["Heading3"]))
    elements.append(Spacer(1, 6))
    line_rows = [["Producto", "SKU", "Cantidad", "Precio unitario", "Subtotal"]]
    for line in invoice.lines.all():
        line_rows.append([
            line.product_name,
            line.sku,
            str(line.quantity),
            f"{line.unit_price:,.2f}",
            f"{line.subtotal:,.2f}",
        ])
    lines_table = Table(line_rows, colWidths=[6 * cm, 3 * cm, 2.5 * cm, 3 * cm, 3 * cm])
    lines_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#222222")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f2f2")]),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
    ]))
    elements.append(lines_table)
    elements.append(Spacer(1, 16))

    totals_rows = [
        ["Subtotal", f"{invoice.currency} {invoice.subtotal:,.2f}"],
        ["Envío", f"{invoice.currency} {invoice.shipping_cost:,.2f}"],
        ["Total", f"{invoice.currency} {invoice.total:,.2f}"],
    ]
    totals_table = Table(totals_rows, colWidths=[13 * cm, 4 * cm])
    totals_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.5, colors.black),
    ]))
    elements.append(totals_table)

    document.build(elements)
    buffer.seek(0)
    return buffer
