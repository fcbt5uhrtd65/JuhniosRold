from rest_framework import permissions


class IsReviewOwnerOrReadOnly(permissions.BasePermission):
    """Cualquiera puede leer; solo el autor de la reseña puede editarla o borrarla."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.user_id == request.user.id
