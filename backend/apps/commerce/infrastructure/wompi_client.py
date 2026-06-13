import hashlib
import hmac
import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings

from ..domain.exceptions import InvalidWebhookSignature, PaymentConfigurationError


class WompiClient:
    CHECKOUT_URL = "https://checkout.wompi.co/p/"

    def __init__(self):
        self.environment = settings.WOMPI_ENVIRONMENT
        self.public_key = settings.WOMPI_PUBLIC_KEY
        self.private_key = settings.WOMPI_PRIVATE_KEY
        self.events_secret = settings.WOMPI_EVENTS_SECRET
        self.integrity_secret = settings.WOMPI_INTEGRITY_SECRET
        self.base_url = settings.WOMPI_BASE_URL.rstrip("/")
        self.timeout = settings.WOMPI_HTTP_TIMEOUT
        self._validate_configuration()

    def _validate_configuration(self):
        required = {
            "WOMPI_PUBLIC_KEY": self.public_key,
            "WOMPI_PRIVATE_KEY": self.private_key,
            "WOMPI_EVENTS_SECRET": self.events_secret,
            "WOMPI_INTEGRITY_SECRET": self.integrity_secret,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise PaymentConfigurationError(
                f"Faltan variables de entorno de Wompi: {', '.join(missing)}."
            )

        expected_prefix = "test" if self.environment == "sandbox" else "prod"
        expected_values = {
            "WOMPI_PUBLIC_KEY": f"pub_{expected_prefix}_",
            "WOMPI_PRIVATE_KEY": f"prv_{expected_prefix}_",
            "WOMPI_EVENTS_SECRET": f"{expected_prefix}_events_",
            "WOMPI_INTEGRITY_SECRET": f"{expected_prefix}_integrity_",
        }
        invalid = [
            name
            for name, prefix in expected_values.items()
            if not required[name].startswith(prefix)
        ]
        if invalid:
            raise PaymentConfigurationError(
                "Las credenciales de Wompi no corresponden al ambiente configurado: "
                + ", ".join(invalid)
                + "."
            )

        expected_base_url = {
            "sandbox": "https://sandbox.wompi.co/v1",
            "production": "https://production.wompi.co/v1",
        }[self.environment]
        if self.base_url != expected_base_url:
            raise PaymentConfigurationError(
                f"WOMPI_BASE_URL debe ser {expected_base_url} para el ambiente "
                f"{self.environment}."
            )

    def build_integrity_signature(
        self,
        *,
        reference: str,
        amount_in_cents: int,
        currency: str,
        expiration_time: str | None = None,
    ) -> str:
        values = [reference, str(amount_in_cents), currency]
        if expiration_time:
            values.append(expiration_time)
        values.append(self.integrity_secret)
        return hashlib.sha256("".join(values).encode("utf-8")).hexdigest()

    def build_checkout_url(self, **parameters: Any) -> str:
        query = urlencode(
            {key: value for key, value in parameters.items() if value not in (None, "")}
        )
        return f"{self.CHECKOUT_URL}?{query}"

    def validate_event(self, payload: dict, header_checksum: str = "") -> None:
        signature = payload.get("signature") or {}
        properties = signature.get("properties")
        checksum = header_checksum or signature.get("checksum", "")
        timestamp = payload.get("timestamp")

        if not isinstance(properties, list) or not checksum or timestamp is None:
            raise InvalidWebhookSignature("El evento de Wompi no contiene una firma válida.")

        values = [self._event_value(payload.get("data") or {}, path) for path in properties]
        signed_value = "".join(values) + str(timestamp) + self.events_secret
        expected = hashlib.sha256(signed_value.encode("utf-8")).hexdigest()
        if not hmac.compare_digest(expected.lower(), str(checksum).lower()):
            raise InvalidWebhookSignature("La firma del evento de Wompi es inválida.")

        expected_environment = "test" if self.environment == "sandbox" else "prod"
        if payload.get("environment") != expected_environment:
            raise InvalidWebhookSignature(
                "El ambiente del evento no corresponde al ambiente de Wompi configurado."
            )

    def get_transaction(self, transaction_id: str) -> dict:
        request = Request(
            f"{self.base_url}/transactions/{transaction_id}",
            headers={"Authorization": f"Bearer {self.public_key}"},
            method="GET",
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                body = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            raise PaymentConfigurationError(
                f"Wompi respondió HTTP {exc.code} al consultar la transacción."
            ) from exc
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise PaymentConfigurationError(
                "No fue posible consultar la transacción en Wompi."
            ) from exc
        return body.get("data") or {}

    @classmethod
    def _event_value(cls, data: dict, path: str) -> str:
        value: Any = data
        for segment in path.split("."):
            if not isinstance(value, dict) or segment not in value:
                raise InvalidWebhookSignature(
                    f"La propiedad firmada '{path}' no existe en el evento."
                )
            value = value[segment]

        if value is None:
            return ""
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, (dict, list)):
            return json.dumps(value, separators=(",", ":"), ensure_ascii=False)
        return str(value)
