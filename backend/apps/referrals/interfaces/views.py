from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.customers.infrastructure.models import Customer
from apps.identity.interfaces.permissions import HasComponentAccess
from shared.interfaces.viewsets import SoftDeleteModelViewSet

from ..application.use_cases import GetOrCreateReferralCode
from ..infrastructure.models import ReferralRedemption
from ..infrastructure.serializers import ReferralCodeSerializer, ReferralRedemptionSerializer


class MyReferralCodeView(APIView):
    """Código de referido propio del cliente autenticado (se genera si no existe)."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        customer = Customer.objects.filter(user=request.user, deleted_at__isnull=True).first()
        if not customer:
            return Response(
                {"detail": "No se encontró un perfil de cliente asociado a esta cuenta."},
                status=status.HTTP_404_NOT_FOUND,
            )
        referral_code = GetOrCreateReferralCode().execute(customer)
        return Response(ReferralCodeSerializer(referral_code).data)


class ReferralRedemptionViewSet(SoftDeleteModelViewSet):
    queryset = ReferralRedemption.objects.select_related(
        "referral_code", "referrer_customer", "referred_customer"
    )
    serializer_class = ReferralRedemptionSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "referrals.management"
    required_component_action = "view"
    http_method_names = ("get", "head", "options")
    filterset_fields = ("status", "referrer_customer", "referred_customer")
    search_fields = ("referrer_customer__first_name", "referred_customer__first_name", "referral_code__code")
    ordering_fields = ("redeemed_at",)
