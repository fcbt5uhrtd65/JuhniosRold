from rest_framework.response import Response
from rest_framework.views import exception_handler

from shared.domain.exceptions import DomainError


def api_exception_handler(exc, context):
    if isinstance(exc, DomainError):
        return Response(
            {"success": False, "code": exc.code, "message": exc.message},
            status=400,
        )
    return exception_handler(exc, context)
