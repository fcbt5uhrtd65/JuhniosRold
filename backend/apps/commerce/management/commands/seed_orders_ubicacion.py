"""
Agrega pedidos de prueba con datos completos de ubicación (dirección, ciudad,
departamento, latitud, longitud) en el formato JSON que usa el checkout real.

Uso:
    python manage.py seed_orders_ubicacion
    python manage.py seed_orders_ubicacion --count 30
"""
import json
import random
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.catalog.infrastructure.models import Price, ProductVariant
from apps.customers.infrastructure.models import Customer
from apps.finance.application.invoicing import GenerateSalesInvoice

from ...infrastructure.models import Order, OrderItem, OrderStatusHistory, Payment

# ---------------------------------------------------------------------------
# Datos de ubicación reales de Colombia con coordenadas
# ---------------------------------------------------------------------------
LOCATIONS = [
    {
        "city": "Barranquilla",
        "department": "Atlántico",
        "streets": [
            ("Carrera 46 #72-110, El Prado", 10.9924, -74.8029),
            ("Calle 72 #57-20, Alto Prado", 10.9889, -74.7960),
            ("Carrera 53 #79-100, Villa Country", 10.9940, -74.7905),
            ("Calle 84 #46-40, Los Nogales", 11.0030, -74.8123),
            ("Carrera 38 #67-15, El Golf", 10.9820, -74.8050),
        ],
    },
    {
        "city": "Bogotá",
        "department": "Cundinamarca",
        "streets": [
            ("Carrera 7 #45-20, La Candelaria", 4.6015, -74.0665),
            ("Calle 116 #15-22, Usaquén", 4.6990, -74.0300),
            ("Carrera 15 #88-64, Chicó", 4.6760, -74.0490),
            ("Avenida 19 #114-53, Santa Bárbara", 4.7020, -74.0410),
            ("Calle 63 #7-83, Chapinero", 4.6440, -74.0620),
        ],
    },
    {
        "city": "Medellín",
        "department": "Antioquia",
        "streets": [
            ("Carrera 43A #34-95, El Poblado", 6.2076, -75.5709),
            ("Calle 10 #42-10, El Poblado", 6.2050, -75.5680),
            ("Carrera 65 #44-27, Laureles", 6.2500, -75.5880),
            ("Calle 30 #82-35, Belén", 6.2330, -75.6050),
            ("Carrera 70 #12-50, Robledo", 6.2680, -75.6010),
        ],
    },
    {
        "city": "Cali",
        "department": "Valle del Cauca",
        "streets": [
            ("Avenida 6N #23-50, Granada", 3.4516, -76.5320),
            ("Carrera 100 #11-60, Ciudad Jardín", 3.3840, -76.5600),
            ("Calle 5 #38-25, San Fernando", 3.4320, -76.5480),
            ("Avenida 9N #14-20, Versalles", 3.4720, -76.5250),
            ("Carrera 122 #17A-11, Pance", 3.3620, -76.5780),
        ],
    },
    {
        "city": "Cartagena",
        "department": "Bolívar",
        "streets": [
            ("Calle del Cuartel #36-60, Centro Histórico", 10.4236, -75.5488),
            ("Avenida el Lago #28-70, Bocagrande", 10.3993, -75.5525),
            ("Carrera 2 #6-150, Castillogrande", 10.3900, -75.5420),
            ("Calle 30 #20-40, Manga", 10.4080, -75.5350),
            ("Diagonal 21 #47-30, Pie de la Popa", 10.4150, -75.5390),
        ],
    },
    {
        "city": "Bucaramanga",
        "department": "Santander",
        "streets": [
            ("Carrera 27 #47-20, Centro", 7.1193, -73.1227),
            ("Calle 48 #32-10, La Ciudadela", 7.1250, -73.1150),
            ("Carrera 35 #54-60, Cabecera del Llano", 7.1380, -73.1080),
            ("Avenida González Valencia #12-45, Sotomayor", 7.1120, -73.1300),
            ("Calle 105 #27-80, Provenza", 7.1480, -73.1200),
        ],
    },
    {
        "city": "Pereira",
        "department": "Risaralda",
        "streets": [
            ("Calle 19 #7-50, Centro", 4.8133, -75.6961),
            ("Carrera 13 #16-55, Álamos", 4.8200, -75.7050),
            ("Avenida 30 de Agosto #45-10, Cuba", 4.7990, -75.7130),
            ("Carrera 7 #22-30, El Lago", 4.8080, -75.6900),
        ],
    },
    {
        "city": "Manizales",
        "department": "Caldas",
        "streets": [
            ("Carrera 23 #26-60, Centro", 5.0703, -75.5138),
            ("Calle 65 #23B-50, Milán", 5.0820, -75.5020),
            ("Avenida Santander #48-20, La Enea", 5.0620, -75.4950),
        ],
    },
]

FIRST_NAMES = (
    "Maria", "Juan", "Laura", "Carlos", "Andrea", "Diego", "Camila", "Felipe",
    "Valentina", "Santiago", "Natalia", "Sebastian", "Daniela", "Andres", "Paula",
    "Julian", "Monica", "Ricardo", "Alejandra", "Mauricio",
)
LAST_NAMES = (
    "Gomez", "Rodriguez", "Martinez", "Lopez", "Garcia", "Perez", "Sanchez",
    "Ramirez", "Torres", "Diaz", "Vargas", "Castro", "Ortiz", "Rojas", "Moreno",
    "Jimenez", "Herrera", "Medina", "Suarez", "Reyes",
)

STATUS_WEIGHTS = (
    (Order.Status.DELIVERED, 45),
    (Order.Status.PAID, 20),
    (Order.Status.PROCESSING, 15),
    (Order.Status.PACKED, 10),
    (Order.Status.SHIPPED, 10),
)

DEFAULT_COUNT = 25


def _pick_location():
    loc = random.choice(LOCATIONS)
    address, lat, lng = random.choice(loc["streets"])
    # Añadir algo de ruido a las coords para que no sean idénticas
    lat += random.uniform(-0.003, 0.003)
    lng += random.uniform(-0.003, 0.003)
    return {
        "city": loc["city"],
        "department": loc["department"],
        "address": address,
        "lat": round(lat, 6),
        "lng": round(lng, 6),
    }


def _build_shipping_address(customer, loc):
    full_name = f"{customer.first_name} {customer.last_name}".strip()
    return json.dumps({
        "full_name": full_name,
        "email": customer.email,
        "phone": customer.phone,
        "address_line1": loc["address"],
        "city": loc["city"],
        "department": loc["department"],
        "country": "Colombia",
        "postal_code": "",
        "latitude": loc["lat"],
        "longitude": loc["lng"],
    }, ensure_ascii=False)


@transaction.atomic
def seed_orders_ubicacion(count=DEFAULT_COUNT):
    variants = list(ProductVariant.objects.filter(is_active=True).select_related("product"))
    if not variants:
        raise CommandError("No hay productos activos. Ejecuta `seed_catalog` primero.")

    customers = list(Customer.objects.all())
    if not customers:
        raise CommandError("No hay clientes. Ejecuta `seed_orders` primero para generar clientes.")

    prices = {p.variant_id: p.amount for p in Price.objects.filter(is_active=True)}
    now = timezone.now()
    created = 0

    for i in range(count):
        days_ago = random.randint(0, 90)
        fake_dt = now - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59))

        customer = random.choice(customers)
        loc = _pick_location()

        status, _ = random.choices(
            [(s, w) for s, w in STATUS_WEIGHTS],
            weights=[w for _, w in STATUS_WEIGHTS],
        )[0]

        shipping_address = _build_shipping_address(customer, loc)

        order = Order.objects.create(
            customer=customer,
            status=status,
            shipping_address=shipping_address,
        )

        chosen_variants = random.sample(variants, k=min(random.randint(1, 3), len(variants)))
        subtotal = 0
        for variant in chosen_variants:
            quantity = random.randint(1, 4)
            unit_price = prices.get(variant.id, 20000)
            item_subtotal = quantity * unit_price
            subtotal += item_subtotal
            OrderItem.objects.create(
                order=order,
                variant=variant,
                product_name=variant.product.name,
                sku=variant.sku,
                presentation=getattr(variant, "presentation_label", ""),
                quantity=quantity,
                unit_price=unit_price,
                subtotal=item_subtotal,
            )

        shipping_cost = 0 if subtotal > 150_000 else 8_000
        Order.objects.filter(pk=order.pk).update(
            subtotal=subtotal,
            shipping_cost=shipping_cost,
            total=subtotal + shipping_cost,
            created_at=fake_dt,
            updated_at=fake_dt,
        )
        OrderItem.objects.filter(order=order).update(created_at=fake_dt, updated_at=fake_dt)

        # Pago: todos los estados visibles en el flujo tienen pago aprobado
        payment = Payment.objects.create(
            order=order,
            provider=Payment.Provider.MOCK,
            reference=f"SEED-UBI-{order.number}",
            amount_in_cents=int((subtotal + shipping_cost) * 100),
            status=Payment.Status.APPROVED,
            payment_method="CARD",
        )
        Payment.objects.filter(pk=payment.pk).update(created_at=fake_dt, updated_at=fake_dt)

        invoice = GenerateSalesInvoice().execute(order=order, payment=payment)
        type(invoice).objects.filter(pk=invoice.pk).update(
            issued_at=fake_dt, created_at=fake_dt, updated_at=fake_dt
        )

        OrderStatusHistory.objects.create(
            order=order,
            status=status,
            notes="Generado por seed_orders_ubicacion",
        )
        OrderStatusHistory.objects.filter(order=order).update(created_at=fake_dt, updated_at=fake_dt)

        created += 1

    return created


class Command(BaseCommand):
    help = "Agrega pedidos de prueba con datos completos de ubicación (lat/lng, ciudad, departamento)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=DEFAULT_COUNT,
            help=f"Número de pedidos a crear (por defecto {DEFAULT_COUNT}).",
        )

    def handle(self, *args, **options):
        count = options["count"]
        created = seed_orders_ubicacion(count)
        self.stdout.write(self.style.SUCCESS(f"Pedidos con ubicación creados: {created}."))
