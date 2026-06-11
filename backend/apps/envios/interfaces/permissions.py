from rest_framework.permissions import BasePermission, SAFE_METHODS


def _roles(user):
    if not user or not user.is_authenticated:
        return set()
    return {name.upper() for name in user.groups.values_list("name", flat=True)}


class CanManageShipping(BasePermission):
    message = "Solo administradores y gerentes pueden gestionar envíos."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or user.is_staff
                or bool(_roles(user) & {"MANAGER", "GERENTE"})
            )
        )


class CanRegisterManualGuide(BasePermission):
    message = "No tienes permiso para registrar guías."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or user.is_staff
                or bool(_roles(user) & {"MANAGER", "GERENTE", "SELLER", "VENDEDOR"})
            )
        )


class IsShipmentOwnerOrOperator(BasePermission):
    message = "No tienes permiso para consultar este envío."

    def has_object_permission(self, request, view, shipment):
        user = request.user
        if user.is_superuser or user.is_staff:
            return True
        if _roles(user) & {"MANAGER", "GERENTE", "SELLER", "VENDEDOR"}:
            return request.method in SAFE_METHODS
        return shipment.pedido.customer.user_id == user.id
