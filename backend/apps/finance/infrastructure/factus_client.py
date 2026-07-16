import json
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings

from ..domain.exceptions import (
    DianConfigurationError,
    DianDuplicatePendingError,
    DianRejectionError,
    DianTransientError,
)


class FactusClient:
    """Cliente para el proveedor tecnológico Factus (facturación electrónica DIAN)."""

    _token_cache: dict[str, Any] = {}

    def __init__(self):
        self.base_url = settings.FACTUS_BASE_URL.rstrip("/")
        self.client_id = settings.FACTUS_CLIENT_ID
        self.client_secret = settings.FACTUS_CLIENT_SECRET
        self.username = settings.FACTUS_USERNAME
        self.password = settings.FACTUS_PASSWORD
        self.timeout = settings.FACTUS_HTTP_TIMEOUT
        self._validate_configuration()

    def _validate_configuration(self):
        required = {
            "FACTUS_CLIENT_ID": self.client_id,
            "FACTUS_CLIENT_SECRET": self.client_secret,
            "FACTUS_USERNAME": self.username,
            "FACTUS_PASSWORD": self.password,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise DianConfigurationError(
                f"Faltan variables de entorno de Factus: {', '.join(missing)}."
            )

    def _get_access_token(self) -> str:
        cached = self._token_cache.get(self.client_id)
        if cached and cached["expires_at"] > time.time():
            return cached["access_token"]

        # Factus exige form-data (no JSON) para el endpoint de token.
        payload = urlencode(
            {
                "grant_type": "password",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "username": self.username,
                "password": self.password,
            }
        ).encode("utf-8")
        request = Request(
            f"{self.base_url}/oauth/token",
            data=payload,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            method="POST",
        )
        body = self._send(request)
        access_token = body.get("access_token")
        expires_in = body.get("expires_in", 3600)
        if not access_token:
            raise DianTransientError("Factus no devolvió un access_token válido.")

        self._token_cache[self.client_id] = {
            "access_token": access_token,
            "expires_at": time.time() + int(expires_in) - 30,
        }
        return access_token

    def validate_bill(self, payload: dict) -> dict:
        access_token = self._get_access_token()
        request = Request(
            f"{self.base_url}/v2/bills/validate",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": f"Bearer {access_token}",
            },
            method="POST",
        )
        return self._send(request)

    def get_bill(self, number: str) -> dict:
        access_token = self._get_access_token()
        request = Request(
            f"{self.base_url}/v2/bills/{number}",
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {access_token}",
            },
            method="GET",
        )
        return self._send(request)

    def delete_bill(self, reference_code: str) -> dict:
        access_token = self._get_access_token()
        request = Request(
            f"{self.base_url}/v2/bills/destroy/reference/{reference_code}",
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {access_token}",
            },
            method="DELETE",
        )
        return self._send(request)

    def _send(self, request: Request) -> dict:
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            if exc.code == 409:
                raise DianDuplicatePendingError(
                    f"Factus reporta una factura pendiente con esa referencia: {body}"
                ) from exc
            if 400 <= exc.code < 500:
                raise DianRejectionError(
                    f"Factus rechazó la solicitud (HTTP {exc.code}): {body}"
                ) from exc
            raise DianTransientError(
                f"Factus respondió HTTP {exc.code}: {body}"
            ) from exc
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise DianTransientError(
                f"No fue posible comunicarse con Factus: {exc}"
            ) from exc
