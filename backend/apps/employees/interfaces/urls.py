from rest_framework.routers import DefaultRouter

from .views import ContractViewSet, DepartmentViewSet, EmployeeViewSet, PositionViewSet

router = DefaultRouter()
router.register("departments", DepartmentViewSet)
router.register("positions", PositionViewSet)
router.register("contracts", ContractViewSet)
router.register("", EmployeeViewSet, basename="employee")

urlpatterns = router.urls
