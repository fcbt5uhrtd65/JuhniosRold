from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AttendanceViewSet,
    EmployeeDocumentViewSet,
    HRNotificationViewSet,
    PayrollViewSet,
    PerformanceReviewViewSet,
    VacationRequestAttachmentViewSet,
    VacationRequestPdfView,
    VacationRequestViewSet,
)

router = DefaultRouter()
router.register("attendance", AttendanceViewSet)
router.register("vacations", VacationRequestViewSet)
router.register("requests", VacationRequestViewSet, basename="hr-request")
router.register("request-attachments", VacationRequestAttachmentViewSet)
router.register("payroll", PayrollViewSet)
router.register("performance-reviews", PerformanceReviewViewSet)
router.register("documents", EmployeeDocumentViewSet)
router.register("notifications", HRNotificationViewSet)

urlpatterns = [
    path("requests/<uuid:pk>/pdf/", VacationRequestPdfView.as_view(), name="vacation-request-pdf"),
    *router.urls,
]
