import uuid
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from shared.domain.exceptions import BusinessRuleViolation

from ..services import OrderInventoryService
from ...domain.repositories import PaymentGateway
from ...domain.value_objects import WompiCheckout
from ...infrastructure.models import Order, OrderStatusHistory, Payment
from ...infrastructure.payment_gateways import WompiPaymentGateway


class InitiateWompiPayment:
    def __init__(self, gateway: PaymentGateway | None = None):
        self.gateway = gateway or WompiPaymentGateway()

    @transaction.atomic
    def execute(self, *, order_id, actor=None):
        if settings.PAYMENT_PROVIDER != "wompi":
            raise BusinessRuleViolation("Wompi no es el proveedor de pagos activo.")
        order = (
            Order.objects.select_for_update()
            .select_related("customer")
            .prefetch_related("items__variant")
            .get(pk=order_id)
        )

        if order.status in (Order.Status.PAID, Order.Status.DELIVERED):
            raise BusinessRuleViolation("El pedido ya fue pagado.")
        if order.status == Order.Status.CANCELLED:
            raise BusinessRuleViolation("No se puede pagar un pedido cancelado.")
        if order.total <= 0:
            raise BusinessRuleViolation("El pedido no tiene un monto válido para pagar.")

        OrderInventoryService.reserve(order)

        payment = (
            order.payments.filter(
                provider=Payment.Provider.WOMPI,
                status=Payment.Status.PENDING,
            )
            .order_by("-created_at")
            .first()
        )
        if payment is None:
            payment = Payment.objects.create(
                order=order,
                provider=Payment.Provider.WOMPI,
                reference=f"{order.number}-{uuid.uuid4().hex[:10].upper()}",
                amount_in_cents=self._amount_in_cents(order.total),
                currency="COP",
            )

        expiration_time = self._expiration_time()
        signature = self.gateway.build_integrity_signature(
            reference=payment.reference,
            amount_in_cents=payment.amount_in_cents,
            currency=payment.currency,
            expiration_time=expiration_time,
        )
        redirect_url = (
            f"{settings.FRONTEND_URL.rstrip('/')}/pago/resultado"
            f"?pedido_id={order.id}"
        )
        checkout_url = self.gateway.build_checkout_url(
            **{
                "public-key": self.gateway.public_key,
                "currency": payment.currency,
                "amount-in-cents": payment.amount_in_cents,
                "reference": payment.reference,
                "signature:integrity": signature,
                "redirect-url": redirect_url,
                "expiration-time": expiration_time,
                "customer-data:email": order.customer.email,
                "customer-data:full-name": str(order.customer),
                "customer-data:phone-number": order.customer.phone,
            }
        )

        if order.status != Order.Status.PAYMENT_PENDING:
            order.status = Order.Status.PAYMENT_PENDING
            OrderStatusHistory.objects.create(
                order=order,
                status=order.status,
                notes="Checkout de Wompi iniciado.",
                changed_by=actor,
            )
        order.payment_reference = payment.reference
        order.save(
            update_fields=(
                "status",
                "payment_reference",
                "inventory_reserved_at",
                "inventory_released_at",
                "updated_at",
            )
        )

        return WompiCheckout(
            checkout_url=checkout_url,
            reference=payment.reference,
            amount_in_cents=payment.amount_in_cents,
            currency=payment.currency,
            public_key=self.gateway.public_key,
            integrity_signature=signature,
            redirect_url=redirect_url,
        )

    @staticmethod
    def _amount_in_cents(total: Decimal) -> int:
        return int((total * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

    @staticmethod
    def _expiration_time() -> str:
        expires_at = timezone.now() + timedelta(
            minutes=settings.WOMPI_CHECKOUT_EXPIRATION_MINUTES
        )
        return expires_at.isoformat(timespec="milliseconds").replace("+00:00", "Z")
