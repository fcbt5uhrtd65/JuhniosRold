from django.conf import settings
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.customers.infrastructure.models import Customer
from apps.identity.infrastructure.models import Component, Role, RoleComponentPermission, User
from apps.identity.infrastructure.serializers import (
    ComponentSerializer,
    GoogleAuthSerializer,
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
    throttle_scope = "auth_sensitive"

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
    throttle_scope = "auth_sensitive"

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
    throttle_scope = "auth_sensitive"

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
    throttle_scope = "auth_sensitive"

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
    throttle_scope = "auth_sensitive"

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
    throttle_scope = "auth_sensitive"

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
    throttle_scope = "auth_sensitive"

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
        # Si el usuario aun no tiene una contrasena utilizable (p.ej. se registro
        # con Google), no hay nada que verificar: esta configurando su primera
        # contrasena en lugar de cambiar una existente.
        if request.user.has_usable_password() and not request.user.check_password(current_password):
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

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = serializer.validated_data["role"]
        component = serializer.validated_data["component"]
        existing = RoleComponentPermission.objects.filter(
            role=role, component=component, deleted_at__isnull=True
        ).first()
        if existing:
            update_serializer = self.get_serializer(existing, data=request.data, partial=True)
            update_serializer.is_valid(raise_exception=True)
            update_serializer.save()
            return Response(update_serializer.data, status=status.HTTP_200_OK)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class GoogleAuthView(generics.GenericAPIView):
    serializer_class = GoogleAuthSerializer
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        from rest_framework_simplejwt.tokens import RefreshToken
        from apps.customers.infrastructure.models import Customer

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        credential = serializer.validated_data["credential"]

        client_id = settings.GOOGLE_OAUTH2_CLIENT_ID
        if not client_id:
            return Response(
                {"detail": "Google OAuth no está configurado en el servidor."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            id_info = id_token.verify_oauth2_token(
                credential, google_requests.Request(), client_id
            )
        except ValueError:
            return Response(
                {"detail": "El token de Google es inválido o ha expirado."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        google_id = id_info["sub"]
        email = id_info.get("email", "").lower()
        first_name = id_info.get("given_name", "")
        last_name = id_info.get("family_name", "")

        if not email:
            return Response(
                {"detail": "Google no proporcionó un correo electrónico."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Buscar por google_id primero, luego por email
        is_new_user = False
        user = User.objects.filter(google_id=google_id).first()
        if user is None:
            user = User.objects.filter(email__iexact=email).first()
            if user is not None:
                # Vincular cuenta existente con Google
                user.google_id = google_id
                update_fields = ["google_id"]
                if not user.first_name and first_name:
                    user.first_name = first_name
                    update_fields.append("first_name")
                if not user.last_name and last_name:
                    user.last_name = last_name
                    update_fields.append("last_name")
                user.save(update_fields=update_fields)

        if user is None:
            # Crear nuevo usuario
            is_new_user = True
            user = User.objects.create_user(
                email=email,
                password=None,
                first_name=first_name,
                last_name=last_name,
                google_id=google_id,
            )
            user.set_unusable_password()
            user.save(update_fields=["password"])
            Customer.objects.get_or_create(
                user=user,
                defaults={
                    "document_type": "PENDING",
                    "document_number": f"USR-{user.id.hex}",
                    "first_name": first_name or email.split("@")[0],
                    "last_name": last_name,
                    "email": email,
                    "purchase_mode": Customer.PurchaseMode.RETAIL,
                },
            )
        else:
            # Usuario existente: verificar si le faltan datos clave
            customer = Customer.objects.filter(user=user).first()
            if customer and customer.document_type == "PENDING":
                is_new_user = True

        if not user.is_active:
            return Response(
                {"detail": "Esta cuenta está desactivada."},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "is_new_user": is_new_user,
            },
            status=status.HTTP_200_OK,
        )
