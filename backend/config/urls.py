from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView


def health_check(_request):
    return JsonResponse({"status": "ok", "service": "juhnios-rold-api"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health_check, name="health"),
    path("api/v1/auth/", include("apps.identity.interfaces.urls")),
    path("api/v1/customers/", include("apps.customers.interfaces.urls")),
    path("api/v1/catalog/", include("apps.catalog.interfaces.urls")),
    path("api/v1/inventory/", include("apps.inventory.interfaces.urls")),
    path("api/v1/commerce/", include("apps.commerce.interfaces.urls")),
    path("api/v1/", include("apps.envios.interfaces.urls")),
    path("api/", include("apps.envios.interfaces.urls")),
    path("api/pedidos/", include("apps.commerce.interfaces.order_urls")),
    path("api/pagos/", include("apps.commerce.interfaces.payment_urls")),
    path("api/v1/employees/", include("apps.employees.interfaces.urls")),
    path("api/v1/hr/", include("apps.human_resources.interfaces.urls")),
    path("api/v1/finance/", include("apps.finance.interfaces.urls")),
    path("api/v1/geography/", include("apps.geography.interfaces.urls")),
    path("api/v1/analytics/", include("apps.analytics.interfaces.urls")),
    path("api/v1/audit/", include("apps.audit.interfaces.urls")),
    path("api/v1/notifications/", include("apps.notifications.interfaces.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
