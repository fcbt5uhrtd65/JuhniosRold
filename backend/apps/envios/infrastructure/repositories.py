from ..domain.exceptions import EnvioNoEncontrado
from ..domain.repositories import EnvioRepository, TrackingRepository
from .models import EnvioModel, TrackingEventModel


class DjangoEnvioRepository(EnvioRepository):
    queryset = EnvioModel.objects.select_related(
        "pedido",
        "pedido__customer",
        "transportadora",
        "created_by",
        "updated_by",
    ).prefetch_related("eventos", "eventos__changed_by")

    def get(self, envio_id):
        envio = self.queryset.filter(pk=envio_id).first()
        if not envio:
            raise EnvioNoEncontrado("El envío solicitado no existe.")
        return envio

    def get_by_order(self, pedido_id):
        envio = self.queryset.filter(pedido_id=pedido_id).first()
        if not envio:
            raise EnvioNoEncontrado("El pedido todavía no tiene un envío.")
        return envio

    def create(self, **data):
        return EnvioModel.objects.create(**data)

    def save(self, envio, update_fields=None):
        envio.save(update_fields=update_fields)
        return envio


class DjangoTrackingRepository(TrackingRepository):
    def list_for_shipment(self, envio_id):
        return TrackingEventModel.objects.filter(envio_id=envio_id).select_related(
            "changed_by"
        )

    def add(self, **data):
        external_event_id = data.get("external_event_id")
        if external_event_id:
            event, _ = TrackingEventModel.objects.get_or_create(
                external_event_id=external_event_id,
                defaults=data,
            )
            return event
        return TrackingEventModel.objects.create(**data)
