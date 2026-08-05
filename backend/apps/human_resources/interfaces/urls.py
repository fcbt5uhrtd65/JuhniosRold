from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AttendanceIntelligenceSettingsViewSet,
    AttendanceViewSet,
    BiometricDeviceViewSet,
    BiometricImportBatchViewSet,
    CompanyDocumentViewSet,
    EmployeeBiometricIdViewSet,
    EmployeeDocumentViewSet,
    EmployeeWorkScheduleViewSet,
    HRNotificationViewSet,
    PayrollLegalParameterViewSet,
    PayrollPeriodViewSet,
    PayrollViewSet,
    PerformanceReviewViewSet,
    PublicHolidayViewSet,
    VacationRequestAttachmentViewSet,
    VacationRequestPdfView,
    VacationRequestViewSet,
    WorkScheduleTemplateViewSet,
)

router = DefaultRouter()
router.register("attendance", AttendanceViewSet)
router.register("vacations", VacationRequestViewSet)
router.register("requests", VacationRequestViewSet, basename="hr-request")
router.register("request-attachments", VacationRequestAttachmentViewSet)
router.register("payroll", PayrollViewSet)
router.register("performance-reviews", PerformanceReviewViewSet)
router.register("documents", EmployeeDocumentViewSet)
router.register("company-documents", CompanyDocumentViewSet)
router.register("notifications", HRNotificationViewSet)
router.register("holidays", PublicHolidayViewSet)
router.register("payroll-legal-parameters", PayrollLegalParameterViewSet)
router.register("payroll-periods", PayrollPeriodViewSet)
router.register("work-schedule-templates", WorkScheduleTemplateViewSet)
router.register("work-schedules", EmployeeWorkScheduleViewSet)
router.register("biometric-devices", BiometricDeviceViewSet)
router.register("biometric-ids", EmployeeBiometricIdViewSet)
router.register("biometric-imports", BiometricImportBatchViewSet)
router.register("attendance-intelligence-settings", AttendanceIntelligenceSettingsViewSet)

urlpatterns = [
    path("requests/<uuid:pk>/pdf/", VacationRequestPdfView.as_view(), name="vacation-request-pdf"),
    *router.urls,
]
