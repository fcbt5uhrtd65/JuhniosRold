from django.contrib.auth.models import Group
from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response

from ..infrastructure.models import User
from ..infrastructure.serializers import (
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    RoleSerializer,
    UserSerializer,
)
from .permissions import IsAdministrator


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = (permissions.AllowAny,)


class PasswordResetRequestView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)
    serializer_class = PasswordResetRequestSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"message": "Si el correo existe, se enviarán instrucciones de recuperación."},
            status=status.HTTP_202_ACCEPTED,
        )


class PasswordResetConfirmView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)
    serializer_class = PasswordResetConfirmSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"message": "La contraseña fue actualizada."})


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(deleted_at__isnull=True).prefetch_related("groups")
    serializer_class = UserSerializer
    permission_classes = (IsAdministrator,)
    search_fields = ("email", "first_name", "last_name")
    ordering_fields = ("email", "date_joined")

    def perform_destroy(self, instance):
        instance.soft_delete()


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.prefetch_related("permissions")
    serializer_class = RoleSerializer
    permission_classes = (IsAdministrator,)
    search_fields = ("name",)
