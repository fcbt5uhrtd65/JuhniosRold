from rest_framework.routers import DefaultRouter

from .views import (
    AttendanceViewSet,
    EmployeeDocumentViewSet,
    PayrollViewSet,
    PerformanceReviewViewSet,
    VacationRequestViewSet,
)

router = DefaultRouter()
router.register("attendance", AttendanceViewSet)
router.register("vacations", VacationRequestViewSet)
router.register("payroll", PayrollViewSet)
router.register("performance-reviews", PerformanceReviewViewSet)
router.register("documents", EmployeeDocumentViewSet)

urlpatterns = router.urls
