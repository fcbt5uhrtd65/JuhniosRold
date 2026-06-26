from django.conf import settings
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.customers.infrastructure.models import Customer
from apps.identity.infrastructure.models import Component, Role, RoleComponentPermission, User
from apps.identity.infrastructure.serializers import (
    ComponentSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    PasswordResetVerifyCodeSerializer,
    RegisterResendCodeSerializer,
    RegisterSerializer,
    RegisterVerifySerializer,
    RoleComponentPermissionSerializer,
    RoleSerializer,
    UserSerializer,
)

from .permissions import HasComponentAccess


def _verification_response_data(verification, message):
    email = getattr(verification, "email", "")
    if not email and hasattr(verification, "user"):
        email = verification.user.email
    data = {
        "message": message,
        "verification_id": verification.id,
        "email": email,
        "expires_at": verification.expires_at,
    }
    if settings.DEBUG and hasattr(verification, "debug_code"):
        data["debug_code"] = verification.debug_code
    return data


class CheckAvailabilityView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        document_number = request.data.get("document_number", "").strip()
        errors = {}
        if email and User.objects.filter(email__iexact=email).exists():
            errors["email"] = "El correo ya se encuentra registrado."
        if document_number and Customer.objects.filter(document_number__iexact=document_number).exists():
            errors["document_number"] = "El número de documento ya se encuentra registrado."
        if errors:
            return Response(errors, status=status.HTTP_409_CONFLICT)
        return Response({"ok": True}, status=status.HTTP_200_OK)


class RegisterView(generics.GenericAPIView):
    serializer_class = RegisterSerializer
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verification = serializer.save()
        return Response(
            _verification_response_data(
                verification,
                "Enviamos un codigo de verificacion a tu correo.",
            ),
            status=status.HTTP_202_ACCEPTED,
        )


class RegisterVerifyView(generics.GenericAPIView):
    serializer_class = RegisterVerifySerializer
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(
            {
                "user": UserSerializer(result["user"]).data,
                "access": result["access"],
                "refresh": result["refresh"],
            },
            status=status.HTTP_201_CREATED,
        )


class RegisterResendCodeView(generics.GenericAPIView):
    serializer_class = RegisterResendCodeSerializer
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verification = serializer.save()
        return Response(
            _verification_response_data(
                verification,
                "Enviamos un nuevo codigo de verificacion.",
            ),
            status=status.HTTP_202_ACCEPTED,
        )


class PasswordResetRequestView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)
    serializer_class = PasswordResetRequestSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verification = serializer.save()
        if verification is None:
            return Response(
                {"message": "Si el correo existe, se enviara un codigo de recuperacion."},
                status=status.HTTP_202_ACCEPTED,
            )
        return Response(
            _verification_response_data(
                verification,
                "Enviamos un codigo de recuperacion a tu correo.",
            ),
            status=status.HTTP_202_ACCEPTED,
        )


class PasswordResetVerifyCodeView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)
    serializer_class = PasswordResetVerifyCodeSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.save()
        return Response(
            {
                "message": "Codigo verificado. Ya puedes restablecer tu contraseña.",
                "reset_token": token.token,
            }
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
    queryset = User.objects.filter(deleted_at__isnull=True).select_related("role")
    serializer_class = UserSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "identity.users"
    search_fields = ("email", "first_name", "last_name")
    ordering_fields = ("email", "date_joined")

    def get_permissions(self):
        if self.action in {"me", "change_password"}:
            return (permissions.IsAuthenticated(),)
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()

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
        role_code = str(request.data.get("role", "")).upper()
        if not role_code:
            return Response(
                {"role": ["El rol enviado no es valido."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        role = Role.objects.filter(code=role_code, deleted_at__isnull=True).first()
        if not role:
            return Response(
                {"role": ["El rol enviado no existe."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.role = role
        user.save()
        return Response(self.get_serializer(user).data)


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.filter(deleted_at__isnull=True).prefetch_related("component_permissions__component")
    serializer_class = RoleSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "identity.roles"
    search_fields = ("code", "name")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class ComponentViewSet(viewsets.ModelViewSet):
    queryset = Component.objects.filter(deleted_at__isnull=True)
    serializer_class = ComponentSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "identity.components"
    search_fields = ("code", "name")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class RoleComponentPermissionViewSet(viewsets.ModelViewSet):
    queryset = RoleComponentPermission.objects.filter(deleted_at__isnull=True).select_related("role", "component")
    serializer_class = RoleComponentPermissionSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "identity.roles"
    search_fields = ("role__code", "component__code")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()
