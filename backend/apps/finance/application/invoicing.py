from django.db import transaction
from django.utils import timezone

from ..infrastructure.issuer import DIAN_RESOLUTION
from ..infrastructure.models import (
    FinancialTransaction,
    SalesInvoice,
    SalesInvoiceLine,
)
from ..infrastructure.tasks import submit_invoice_to_dian


class GenerateSalesInvoice:
    @transaction.atomic
    def execute(self, *, order, payment, actor=None):
        existing = SalesInvoice.objects.filter(order=order).first()
        if existing:
            return existing

        financial_transaction = FinancialTransaction.objects.create(
            transaction_type=FinancialTransaction.Type.INCOME,
            category="Venta e-commerce",
            description=f"Venta pagada del pedido {order.number}",
            amount=order.total,
            occurred_on=timezone.localdate(),
            reference=order.number,
            created_by=actor,
        )
        customer = order.customer
        is_wholesale = customer.purchase_mode == customer.PurchaseMode.WHOLESALE
        invoice = SalesInvoice.objects.create(
            order=order,
            payment=payment,
            financial_transaction=financial_transaction,
            currency=payment.currency,
            subtotal=order.subtotal,
            shipping_cost=order.shipping_cost,
            total=order.total,
            customer_name=str(customer),
            customer_business_name=customer.company_name if is_wholesale else "",
            customer_email=customer.email,
            customer_document=f"{customer.document_type} {customer.document_number}",
            billing_address=order.shipping_address,
            dian_resolution=DIAN_RESOLUTION,
        )
        SalesInvoiceLine.objects.bulk_create(
            [
                SalesInvoiceLine(
                    invoice=invoice,
                    product_name=item.product_name,
                    sku=item.sku,
                    presentation=item.presentation,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    subtotal=item.subtotal,
                )
                for item in order.items.all()
            ]
        )
        transaction.on_commit(lambda: submit_invoice_to_dian.delay(invoice.id))
        return invoice
