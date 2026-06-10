from django.contrib.auth.models import Group
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
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

    @action(
        detail=False,
        methods=("get", "patch"),
        permission_classes=(permissions.IsAuthenticated,),
        url_path="me",
    )
    def me(self, request):
        if request.method == "PATCH":
            allowed_fields = {"first_name", "last_name", "phone"}
            data = {key: value for key, value in request.data.items() if key in allowed_fields}
            serializer = self.get_serializer(request.user, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(self.get_serializer(request.user).data)

    @action(
        detail=False,
        methods=("patch",),
        permission_classes=(permissions.IsAuthenticated,),
        url_path="me/password",
    )
    def change_password(self, request):
        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")
        if not request.user.check_password(current_password):
            return Response(
                {"current_password": ["La contrasena actual no es correcta."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(new_password) < 8:
            return Response(
                {"new_password": ["La nueva contrasena debe tener al menos 8 caracteres."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.set_password(new_password)
        request.user.save(update_fields=("password",))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=("patch",), url_path="role")
    def role(self, request, pk=None):
        user = self.get_object()
        role = str(request.data.get("role", "")).upper()
        allowed_roles = {"ADMIN", "PRO", "SELLER", "DISTRIBUTOR", "CLIENT"}
        if role not in allowed_roles:
            return Response(
                {"role": ["El rol enviado no es valido."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_staff = role == "ADMIN"
        user.save(update_fields=("is_staff",))
        if role == "ADMIN":
            user.groups.clear()
        else:
            group, _ = Group.objects.get_or_create(name=role)
            user.groups.set((group,))
        return Response(self.get_serializer(user).data)


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.prefetch_related("permissions")
    serializer_class = RoleSerializer
    permission_classes = (IsAdministrator,)
    search_fields = ("name",)
