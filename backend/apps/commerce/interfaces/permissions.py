from rest_framework.permissions import BasePermission


class IsOrderOwnerOrStaff(BasePermission):
    message = "No tienes permiso para operar sobre este pedido."

    def has_object_permission(self, request, view, order):
        user = request.user
        has_access = getattr(user, "has_component_access", lambda *_args, **_kwargs: False)
        if getattr(user, "has_full_access", False):
            return True
        if has_access("commerce.orders", "edit"):
            return True
        return getattr(user, "customer_profile", None) == order.customer
