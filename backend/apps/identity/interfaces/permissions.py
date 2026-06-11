from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdministrator(BasePermission):
    message = "Solo los administradores pueden acceder."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "has_full_access", False)
        )


class HasComponentAccess(BasePermission):
    message = "No tienes permiso para acceder a este componente."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        component_code = getattr(view, "required_component", "")
        if not component_code:
            return False

        action = getattr(view, "required_component_action", "")
        if not action:
            action = "view" if request.method in SAFE_METHODS else "edit"

        if getattr(user, "has_full_access", False):
            return True
        return bool(user.has_component_access(component_code, action))
