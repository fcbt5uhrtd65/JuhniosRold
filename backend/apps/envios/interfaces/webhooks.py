from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..application.dtos import ActualizarEstadoEnvioDTO
from ..application.use_cases import ActualizarEstadoEnvioUseCase
from ..infrastructure.models import EnvioModel
from ..infrastructure.serializers import WebhookTrackingSerializer
from ..infrastructure.shipping_gateways import get_shipping_gateway


class ShippingWebhookView(APIView):
    authentication_classes = ()
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        provider = request.headers.get("X-Shipping-Provider", settings.SHIPPING_PROVIDER)
        signature = request.headers.get("X-Shipping-Signature", "")
        gateway = get_shipping_gateway(provider)
        gateway.validate_webhook(payload=request.body, signature=signature)

        serializer = WebhookTrackingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data.get("envio_id"):
            envio = get_object_or_404(EnvioModel, pk=data["envio_id"])
        else:
            envio = get_object_or_404(
                EnvioModel,
                external_shipment_id=data["external_shipment_id"],
            )

        before_count = envio.eventos.count()
        envio = ActualizarEstadoEnvioUseCase().execute(
            envio_id=envio.id,
            dto=ActualizarEstadoEnvioDTO(
                estado=data["estado"],
                descripcion=data.get("descripcion", ""),
                ubicacion=data.get("ubicacion", ""),
                fecha_evento=data.get("fecha_evento"),
                external_event_id=data["event_id"],
                raw_payload=request.data,
            ),
        )
        duplicate = envio.eventos.count() == before_count
        return Response(
            {"processed": True, "duplicate": duplicate, "envio_id": envio.id},
            status=status.HTTP_200_OK,
        )
