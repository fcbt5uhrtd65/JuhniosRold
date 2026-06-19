from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from .views import (
    ComponentViewSet,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterResendCodeView,
    RegisterView,
    RegisterVerifyView,
    RoleComponentPermissionViewSet,
    RoleViewSet,
    UserViewSet,
)

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("roles", RoleViewSet, basename="role")
router.register("components", ComponentViewSet, basename="component")
router.register("role-permissions", RoleComponentPermissionViewSet, basename="role-permission")

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("register/verify/", RegisterVerifyView.as_view(), name="register-verify"),
    path("register/resend-code/", RegisterResendCodeView.as_view(), name="register-resend-code"),
    path("login/", TokenObtainPairView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token-verify"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("", include(router.urls)),
]
