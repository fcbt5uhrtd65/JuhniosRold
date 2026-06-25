from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.infrastructure.models import Notification
from apps.notifications.infrastructure.serializers import NotificationSerializer


def _customer(request):
    return getattr(request.user, "customer_profile", None)


class NotificationListView(APIView):
    """GET  /api/v1/notifications/  — lista las últimas 50 notificaciones del cliente."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        customer = _customer(request)
        if customer is None:
            return Response({"detail": "Sin perfil de cliente."}, status=status.HTTP_403_FORBIDDEN)

        qs = (
            Notification.objects.filter(customer=customer)
            .order_by("-created_at")[:50]
        )
        return Response(NotificationSerializer(qs, many=True).data)


class NotificationMarkReadView(APIView):
    """PATCH /api/v1/notifications/<id>/read/  — marca una notificación como leída."""

    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request, pk):
        customer = _customer(request)
        if customer is None:
            return Response({"detail": "Sin perfil de cliente."}, status=status.HTTP_403_FORBIDDEN)

        try:
            notif = Notification.objects.get(pk=pk, customer=customer)
        except Notification.DoesNotExist:
            return Response({"detail": "No encontrada."}, status=status.HTTP_404_NOT_FOUND)

        if not notif.read:
            notif.read = True
            notif.read_at = timezone.now()
            notif.save(update_fields=("read", "read_at", "updated_at"))

        return Response(NotificationSerializer(notif).data)


class NotificationMarkAllReadView(APIView):
    """PATCH /api/v1/notifications/read-all/  — marca todas como leídas."""

    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request):
        customer = _customer(request)
        if customer is None:
            return Response({"detail": "Sin perfil de cliente."}, status=status.HTTP_403_FORBIDDEN)

        now = timezone.now()
        Notification.objects.filter(customer=customer, read=False).update(
            read=True, read_at=now, updated_at=now
        )
        return Response({"detail": "Todas marcadas como leídas."})
