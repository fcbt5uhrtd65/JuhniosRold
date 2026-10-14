from rest_framework.permissions import BasePermission

PAYMENT_ACCOUNTS_COMPONENT = "finance.payment_accounts"


class IsAccounting(BasePermission):
    """Administradores y Contabilidad (rol principal o adicional) mediante el
    componente ``finance.payment_accounts``."""

    message = "Solo Administración y Contabilidad pueden gestionar cuentas de cobro."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        action = "view" if getattr(view, "action", None) in {"list", "retrieve"} else "edit"
        return bool(user.has_component_access(PAYMENT_ACCOUNTS_COMPONENT, action))
