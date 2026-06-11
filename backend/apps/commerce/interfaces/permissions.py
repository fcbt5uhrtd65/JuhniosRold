from rest_framework.permissions import BasePermission


class IsOrderOwnerOrStaff(BasePermission):
    message = "No tienes permiso para operar sobre este pedido."

    def has_object_permission(self, request, view, order):
        if request.user.is_staff:
            return True
        return getattr(request.user, "customer_profile", None) == order.customer
