from decimal import Decimal, InvalidOperation

from django.db.models import Count, Q
from django.http import FileResponse
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.interfaces.permissions import HasComponentAccess
from shared.interfaces.viewsets import SoftDeleteModelViewSet

from ..infrastructure.customer_excel import render_customers_xlsx
from ..infrastructure.customer_pdf import render_customers_pdf
from ..infrastructure.models import Customer, CustomerAddress, CustomerContact, CustomerSegment
from ..infrastructure.serializers import (
    CustomerContactSerializer,
    CustomerSegmentSerializer,
    CustomerSerializer,
    MyCustomerProfileSerializer,
)
from .filters import CustomerFilter


class CustomerViewSet(SoftDeleteModelViewSet):
    queryset = Customer.objects.prefetch_related("contacts", "segments").annotate(
        orders_count=Count("orders", filter=~Q(orders__status="CANCELLED"), distinct=True)
    )
    serializer_class = CustomerSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "customers.management"
    filterset_class = CustomerFilter
    search_fields = ("document_number", "first_name", "last_name", "email", "phone")
    ordering_fields = ("created_at", "first_name", "last_name")

    def get_permissions(self):
        self.required_component_action = (
            "view" if self.action in {"list", "retrieve", "purchase_history", "export_pdf", "export_xlsx"} else "edit"
        )
        return super().get_permissions()

    @action(detail=True, methods=("get",), url_path="purchase-history")
    def purchase_history(self, request, pk=None):
        customer = self.get_object()
        orders = customer.orders.values("id", "number", "status", "total", "created_at")
        return Response(orders)

    @action(detail=False, methods=("get",), url_path="export-pdf")
    def export_pdf(self, request):
        queryset = self.filter_queryset(self.get_queryset()).order_by("first_name", "last_name")
        pdf_buffer = render_customers_pdf(queryset)
        return FileResponse(
            pdf_buffer,
            as_attachment=True,
            filename="clientes-juhnios-rold.pdf",
            content_type="application/pdf",
        )

    @action(detail=False, methods=("get",), url_path="export-xlsx")
    def export_xlsx(self, request):
        queryset = self.filter_queryset(self.get_queryset()).order_by("first_name", "last_name")
        xlsx_buffer = render_customers_xlsx(queryset)
        return FileResponse(
            xlsx_buffer,
            as_attachment=True,
            filename="clientes-juhnios-rold.xlsx",
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )


class CustomerContactViewSet(SoftDeleteModelViewSet):
    queryset = CustomerContact.objects.select_related("customer")
    serializer_class = CustomerContactSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "customers.management"
    filterset_fields = ("customer", "is_primary")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class CustomerSegmentViewSet(SoftDeleteModelViewSet):
    queryset = CustomerSegment.objects.all()
    serializer_class = CustomerSegmentSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "customers.management"
    search_fields = ("name",)

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


def _serialize_my_profile(customer, address):
    data = MyCustomerProfileSerializer(customer).data
    data["state"] = address.state if address else ""
    data["country"] = address.country if address else ""
    data["latitude"] = float(address.latitude) if address else None
    data["longitude"] = float(address.longitude) if address else None
    data["reference"] = address.reference if address else ""
    return data


def _parse_coordinate(value):
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return None


class MyCustomerProfileView(APIView):
    """Perfil propio del cliente autenticado (datos registrados al crear la cuenta)."""

    permission_classes = (permissions.IsAuthenticated,)

    def _get_customer(self, request):
        return Customer.objects.filter(user=request.user, deleted_at__isnull=True).first()

    def get(self, request):
        customer = self._get_customer(request)
        if not customer:
            return Response(
                {"detail": "No se encontro un perfil de cliente asociado a esta cuenta."},
                status=status.HTTP_404_NOT_FOUND,
            )
        address = customer.addresses.filter(is_default=True).order_by("-created_at").first()
        return Response(_serialize_my_profile(customer, address))

    def patch(self, request):
        customer = self._get_customer(request)
        if not customer:
            return Response(
                {"detail": "No se encontro un perfil de cliente asociado a esta cuenta."},
                status=status.HTTP_404_NOT_FOUND,
            )

        customer_fields = {
            "first_name", "last_name", "phone", "address", "city", "document_type", "document_number",
            "purchase_mode", "company_id_type", "company_id_type_other", "company_id_number",
            "company_name", "business_type", "is_international_distributor", "company_phone",
        }
        customer_data = {key: value for key, value in request.data.items() if key in customer_fields}
        serializer = MyCustomerProfileSerializer(customer, data=customer_data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        location_fields = {"state", "country", "reference", "latitude", "longitude"}
        if any(field in request.data for field in location_fields):
            address = customer.addresses.filter(is_default=True).order_by("-created_at").first()
            latitude = _parse_coordinate(request.data.get("latitude"))
            longitude = _parse_coordinate(request.data.get("longitude"))
            if address:
                if "state" in request.data:
                    address.state = request.data.get("state") or ""
                if "country" in request.data:
                    address.country = request.data.get("country") or ""
                if "reference" in request.data:
                    address.reference = request.data.get("reference") or ""
                if latitude is not None:
                    address.latitude = latitude
                if longitude is not None:
                    address.longitude = longitude
                address.address = customer.address
                address.city = customer.city
                address.save()
            elif latitude is not None and longitude is not None:
                CustomerAddress.objects.create(
                    customer=customer,
                    address=customer.address,
                    city=customer.city,
                    state=request.data.get("state") or "",
                    country=request.data.get("country") or "",
                    latitude=latitude,
                    longitude=longitude,
                    reference=request.data.get("reference") or "",
                    is_default=True,
                )

        address = customer.addresses.filter(is_default=True).order_by("-created_at").first()
        return Response(_serialize_my_profile(customer, address))
