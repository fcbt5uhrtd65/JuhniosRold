from rest_framework.routers import DefaultRouter

from .views import ContractViewSet, DepartmentViewSet, EmployeeViewSet, PositionViewSet

router = DefaultRouter()
router.register("", EmployeeViewSet, basename="employee")
router.register("departments", DepartmentViewSet)
router.register("positions", PositionViewSet)
router.register("contracts", ContractViewSet)

urlpatterns = router.urls
