from ...infrastructure.repositories import DjangoEnvioRepository


class ConsultarTrackingUseCase:
    def __init__(self, repository=None):
        self.repository = repository or DjangoEnvioRepository()

    def execute(self, *, envio_id=None, pedido_id=None):
        if envio_id:
            return self.repository.get(envio_id)
        return self.repository.get_by_order(pedido_id)
