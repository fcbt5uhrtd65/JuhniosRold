from rest_framework.routers import DefaultRouter

from .views import (
    BranchViewSet,
    ContractViewSet,
    DepartmentViewSet,
    EmployeeChangeLogViewSet,
    EmployeePositionHistoryViewSet,
    EmployeeSalaryHistoryViewSet,
    EmployeeViewSet,
    HRFieldConfigurationViewSet,
    PositionViewSet,
    WorkDayViewSet,
)

router = DefaultRouter()
router.register("departments", DepartmentViewSet)
router.register("positions", PositionViewSet)
router.register("branches", BranchViewSet)
router.register("work-days", WorkDayViewSet)
router.register("field-configurations", HRFieldConfigurationViewSet)
router.register("contracts", ContractViewSet)
router.register("change-logs", EmployeeChangeLogViewSet)
router.register("salary-history", EmployeeSalaryHistoryViewSet)
router.register("position-history", EmployeePositionHistoryViewSet)
router.register("", EmployeeViewSet, basename="employee")

urlpatterns = router.urls
