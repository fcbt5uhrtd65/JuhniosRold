import random
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.catalog.infrastructure.models import Price, ProductVariant
from apps.customers.infrastructure.models import Customer
from apps.finance.application.invoicing import GenerateSalesInvoice

from ...infrastructure.models import Order, OrderItem, OrderStatusHistory, Payment

MONTHS_BACK = 6
TARGET_ORDERS = 120

DOCUMENT_TYPES = ("CC", "CE")
CITIES = ("Bogotá", "Medellín", "Cali", "Barranquilla", "Bucaramanga")
FIRST_NAMES = (
    "Maria", "Juan", "Laura", "Carlos", "Andrea", "Diego", "Camila", "Felipe",
    "Valentina", "Santiago", "Natalia", "Sebastian", "Daniela", "Andres", "Paula",
)
LAST_NAMES = (
    "Gomez", "Rodriguez", "Martinez", "Lopez", "Garcia", "Perez", "Sanchez",
    "Ramirez", "Torres", "Diaz", "Vargas", "Castro", "Ortiz", "Rojas", "Moreno",
)

STATUS_WEIGHTS = (
    (Order.Status.DELIVERED, 60),
    (Order.Status.SHIPPED, 8),
    (Order.Status.PROCESSING, 7),
    (Order.Status.PENDING, 9),
    (Order.Status.CANCELLED, 10),
    (Order.Status.RETURNED, 6),
)


def _seed_customers(count):
    created = []
    for index in range(count):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        customer = Customer.objects.create(
            document_type=random.choice(DOCUMENT_TYPES),
            document_number=f"SEED-CUST-{index:04d}",
            first_name=first_name,
            last_name=last_name,
            email=f"{first_name}.{last_name}.{index}@example.com".lower(),
            phone=f"300{random.randint(1000000, 9999999)}",
            address=f"Calle {random.randint(1, 150)} #{random.randint(1, 99)}-{random.randint(1, 99)}",
            city=random.choice(CITIES),
            wholesale_code=f"JR-MAY-SC{index:04d}",
            is_active=True,
        )
        created.append(customer)
    return created


@transaction.atomic
def seed_orders(customer_count=20):
    if Order.objects.exists():
        return 0, "ya existen pedidos"

    variants = list(ProductVariant.objects.filter(is_active=True).select_related("product"))
    if not variants:
        raise CommandError("No hay productos. Ejecuta `seed_catalog` antes de `seed_orders`.")

    customers = list(Customer.objects.all())
    if not customers:
        customers = _seed_customers(customer_count)

    prices = {price.variant_id: price.amount for price in Price.objects.filter(is_active=True)}

    vip_pool_size = max(2, len(customers) // 10)
    recurring_pool_size = max(5, len(customers) // 3)
    vip_customers = customers[:vip_pool_size]
    recurring_customers = customers[vip_pool_size:vip_pool_size + recurring_pool_size]

    now = timezone.now()
    created = 0

    for _ in range(TARGET_ORDERS):
        days_ago = random.randint(0, MONTHS_BACK * 30)
        fake_dt = now - timedelta(days=days_ago, hours=random.randint(0, 23))

        bucket = random.random()
        if bucket < 0.15 and vip_customers:
            customer = random.choice(vip_customers)
        elif bucket < 0.55 and recurring_customers:
            customer = random.choice(recurring_customers)
        else:
            customer = random.choice(customers)

        status = random.choices(
            [code for code, _ in STATUS_WEIGHTS],
            weights=[weight for _, weight in STATUS_WEIGHTS],
        )[0]

        order = Order.objects.create(
            customer=customer,
            status=status,
            shipping_address=f"{customer.address or 'Dirección de prueba'}, {customer.city or 'Bogotá'}",
        )

        chosen_variants = random.sample(variants, k=min(random.randint(1, 4), len(variants)))
        subtotal = 0
        for variant in chosen_variants:
            quantity = random.randint(1, 6)
            unit_price = prices.get(variant.id, 20000)
            item_subtotal = quantity * unit_price
            subtotal += item_subtotal
            OrderItem.objects.create(
                order=order,
                variant=variant,
                product_name=variant.product.name,
                sku=variant.sku,
                quantity=quantity,
                unit_price=unit_price,
                subtotal=item_subtotal,
            )

        shipping_cost = 0 if subtotal > 150000 else 8000
        Order.objects.filter(pk=order.pk).update(
            subtotal=subtotal,
            shipping_cost=shipping_cost,
            total=subtotal + shipping_cost,
            created_at=fake_dt,
            updated_at=fake_dt,
        )
        OrderItem.objects.filter(order=order).update(created_at=fake_dt, updated_at=fake_dt)

        if status != Order.Status.PENDING:
            payment_status = (
                Payment.Status.DECLINED
                if status in (Order.Status.CANCELLED, Order.Status.RETURNED)
                else Payment.Status.APPROVED
            )
            payment = Payment.objects.create(
                order=order,
                provider=Payment.Provider.MOCK,
                reference=f"SEED-{order.number}",
                amount_in_cents=int((subtotal + shipping_cost) * 100),
                status=payment_status,
            )
            Payment.objects.filter(order=order).update(created_at=fake_dt, updated_at=fake_dt)

            if payment_status == Payment.Status.APPROVED:
                invoice = GenerateSalesInvoice().execute(order=order, payment=payment)
                type(invoice).objects.filter(pk=invoice.pk).update(issued_at=fake_dt, created_at=fake_dt, updated_at=fake_dt)

        OrderStatusHistory.objects.create(order=order, status=status, notes="Generado por seed_orders")
        OrderStatusHistory.objects.filter(order=order).update(created_at=fake_dt, updated_at=fake_dt)

        created += 1

    return created, None


class Command(BaseCommand):
    help = "Genera pedidos históricos de prueba para alimentar los reportes del panel admin."

    def handle(self, *args, **options):
        created, skip_reason = seed_orders()
        if skip_reason:
            self.stdout.write(f"No se generaron pedidos: {skip_reason}.")
        else:
            self.stdout.write(self.style.SUCCESS(f"Pedidos de prueba creados: {created}."))
