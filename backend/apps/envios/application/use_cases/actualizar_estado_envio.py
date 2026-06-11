from ...infrastructure.repositories import DjangoEnvioRepository
from ..services import EnvioStateService


class ActualizarEstadoEnvioUseCase:
    def __init__(self, repository=None):
        self.repository = repository or DjangoEnvioRepository()

    def execute(self, *, envio_id, dto, actor=None):
        envio = self.repository.get(envio_id)
        envio, _, _ = EnvioStateService.change(
            envio=envio,
            estado=dto.estado,
            actor=actor,
            descripcion=dto.descripcion,
            ubicacion=dto.ubicacion,
            fecha_evento=dto.fecha_evento,
            external_event_id=dto.external_event_id,
            raw_payload=dto.raw_payload,
        )
        return self.repository.get(envio.id)
