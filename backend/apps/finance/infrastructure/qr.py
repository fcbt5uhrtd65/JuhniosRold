import io

import qrcode


def build_invoice_qr_image(invoice):
    if invoice.dian_status == invoice.DianStatus.VALIDATED and invoice.dian_qr_url:
        payload = invoice.dian_qr_url
    else:
        payload = "\n".join([
            "NIT EMISOR: 900452638-2",
            f"FACTURA: {invoice.number}",
            f"FECHA: {invoice.issued_at.strftime('%Y-%m-%d')}",
            f"TOTAL: {invoice.currency} {invoice.total}",
            "CUFE: PENDIENTE DE VALIDACION DIAN",
        ])
    qr = qrcode.QRCode(border=1)
    qr.add_data(payload)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer
