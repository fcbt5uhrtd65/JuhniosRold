from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.commerce.infrastructure.models import Order, OrderStatusHistory
from apps.customers.infrastructure.models import Customer
from apps.identity.infrastructure.models import User

from ..application.dtos import ActualizarEstadoEnvioDTO, CrearEnvioDTO
from ..application.use_cases import ActualizarEstadoEnvioUseCase, CrearEnvioUseCase
from ..infrastructure.models import EnvioModel, TrackingEventModel, TransportadoraModel


pytestmark = pytest.mark.django_db


def create_customer(email, document):
    user = User.objects.create_user(email=email, password="Test12345!")
    customer = Customer.objects.create(
        user=user,
        document_number=document,
        first_name="Cliente",
        last_name=document,
        email=email,
        address="Calle 1",
        city="Bogotá",
    )
    return user, customer


def create_paid_order(customer):
    order = Order.objects.create(
        customer=customer,
        status=Order.Status.PAID,
        subtotal=Decimal("50000"),
        shipping_cost=Decimal("10000"),
        total=Decimal("60000"),
        shipping_address="Calle 1, Bogotá",
    )
    OrderStatusHistory.objects.create(order=order, status=order.status)
    return order


def create_shipment(order, actor=None):
    return CrearEnvioUseCase().execute(
        CrearEnvioDTO(pedido_id=order.id),
        actor=actor,
    )


def test_create_manual_shipment_and_register_guide():
    admin = User.objects.create_superuser(email="admin@test.com", password="Test12345!")
    _, customer = create_customer("owner@test.com", "1001")
    order = create_paid_order(customer)
    carrier = TransportadoraModel.objects.create(
        codigo="TEST",
        nombre="Transportadora Test",
    )
    client = APIClient()
    client.force_authenticate(admin)

    create_response = client.post(
        "/api/v1/envios/",
        {"pedido_id": str(order.id)},
        format="json",
    )
    assert create_response.status_code == 201

    response = client.post(
        f"/api/v1/envios/{create_response.data['id']}/registrar-guia-manual/",
        {
            "transportadora_id": str(carrier.id),
            "numero_guia": "TEST-123",
            "tracking_url": "https://tracking.test/TEST-123",
        },
        format="json",
    )
    assert response.status_code == 200
    assert response.data["estado_envio"] == EnvioModel.Estado.GUIA_GENERADA
    assert response.data["numero_guia"] == "TEST-123"
    order.refresh_from_db()
    assert order.status == Order.Status.SHIPPED


def test_customer_can_only_read_own_order_tracking():
    owner_user, owner = create_customer("owner2@test.com", "1002")
    other_user, other = create_customer("other@test.com", "1003")
    order = create_paid_order(owner)
    create_shipment(order)
    other_order = create_paid_order(other)
    client = APIClient()

    client.force_authenticate(owner_user)
    assert client.get(f"/api/v1/pedidos/{order.id}/tracking/").status_code == 200
    assert client.get(f"/api/v1/pedidos/{other_order.id}/tracking/").status_code == 403

    client.force_authenticate(other_user)
    assert client.get(f"/api/v1/pedidos/{order.id}/tracking/").status_code == 403


@pytest.mark.parametrize(
    ("shipment_status", "order_status"),
    [
        (EnvioModel.Estado.EN_TRANSITO, Order.Status.IN_TRANSIT),
        (EnvioModel.Estado.ENTREGADO, Order.Status.DELIVERED),
        (EnvioModel.Estado.DEVUELTO, Order.Status.RETURNED),
    ],
)
def test_shipping_status_synchronizes_order(shipment_status, order_status):
    admin = User.objects.create_superuser(email=f"{shipment_status}@test.com")
    _, customer = create_customer(f"{shipment_status.lower()}@owner.com", shipment_status)
    order = create_paid_order(customer)
    shipment = create_shipment(order, actor=admin)

    ActualizarEstadoEnvioUseCase().execute(
        envio_id=shipment.id,
        dto=ActualizarEstadoEnvioDTO(
            estado=shipment_status,
            descripcion="Actualización de prueba.",
        ),
        actor=admin,
    )

    order.refresh_from_db()
    assert order.status == order_status
    assert order.status_history.filter(status=order_status).exists()


def test_duplicate_external_event_is_idempotent():
    _, customer = create_customer("duplicate@test.com", "1004")
    order = create_paid_order(customer)
    shipment = create_shipment(order)
    dto = ActualizarEstadoEnvioDTO(
        estado=EnvioModel.Estado.EN_TRANSITO,
        descripcion="Evento externo.",
        external_event_id="external-123",
        fecha_evento=timezone.now(),
    )

    ActualizarEstadoEnvioUseCase().execute(envio_id=shipment.id, dto=dto)
    ActualizarEstadoEnvioUseCase().execute(envio_id=shipment.id, dto=dto)

    assert TrackingEventModel.objects.filter(external_event_id="external-123").count() == 1


def test_unknown_carrier_is_rejected():
    admin = User.objects.create_superuser(email="carrier@test.com")
    _, customer = create_customer("carrier-owner@test.com", "1005")
    shipment = create_shipment(create_paid_order(customer), actor=admin)
    client = APIClient()
    client.force_authenticate(admin)

    response = client.post(
        f"/api/v1/envios/{shipment.id}/registrar-guia-manual/",
        {
            "transportadora_id": "11111111-1111-1111-1111-111111111111",
            "numero_guia": "UNKNOWN-1",
        },
        format="json",
    )
    assert response.status_code == 400


def test_cancelled_shipment_is_terminal():
    admin = User.objects.create_superuser(email="cancel@test.com")
    _, customer = create_customer("cancel-owner@test.com", "1006")
    shipment = create_shipment(create_paid_order(customer), actor=admin)
    client = APIClient()
    client.force_authenticate(admin)

    response = client.post(f"/api/v1/envios/{shipment.id}/cancelar/", {}, format="json")
    assert response.status_code == 200
    assert response.data["estado_envio"] == EnvioModel.Estado.CANCELADO

    response = client.put(
        f"/api/v1/envios/{shipment.id}/estado/",
        {"estado": EnvioModel.Estado.EN_TRANSITO},
        format="json",
    )
    assert response.status_code == 400
