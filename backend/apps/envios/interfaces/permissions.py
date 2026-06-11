from rest_framework.permissions import BasePermission


class CanManageShipping(BasePermission):
    message = "Solo usuarios con permiso de envíos pueden gestionar esta sección."

    def has_permission(self, request, view):
        user = request.user
        has_access = getattr(user, "has_component_access", lambda *_args, **_kwargs: False)
        return bool(
            user
            and user.is_authenticated
            and has_access("envios.management", "edit")
        )


class CanRegisterManualGuide(BasePermission):
    message = "No tienes permiso para registrar guías."

    def has_permission(self, request, view):
        user = request.user
        has_access = getattr(user, "has_component_access", lambda *_args, **_kwargs: False)
        return bool(
            user
            and user.is_authenticated
            and has_access("envios.manual_guides", "edit")
        )


class IsShipmentOwnerOrOperator(BasePermission):
    message = "No tienes permiso para consultar este envío."

    def has_object_permission(self, request, view, shipment):
        user = request.user
        has_access = getattr(user, "has_component_access", lambda *_args, **_kwargs: False)
        if getattr(user, "has_full_access", False):
            return True
        if has_access("envios.tracking", "view"):
            return True
        return shipment.pedido.customer.user_id == user.id
