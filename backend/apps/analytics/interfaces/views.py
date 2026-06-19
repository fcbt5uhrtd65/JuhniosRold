from rest_framework import generics, serializers
from rest_framework.response import Response

from apps.identity.interfaces.permissions import HasComponentAccess

from ..application.queries import DashboardQuery, SalesReportQuery
from ..infrastructure.tasks import generate_report


class DashboardResponseSerializer(serializers.Serializer):
    sales_today = serializers.DecimalField(max_digits=18, decimal_places=2)
    orders_by_status = serializers.ListField()
    top_products = serializers.ListField()
    critical_stock = serializers.ListField()
    new_customers = serializers.IntegerField()
    attendance_today = serializers.IntegerField()
    payroll_expenses = serializers.DecimalField(max_digits=18, decimal_places=2)
    income_vs_expenses = serializers.DictField()


class ReportExportSerializer(serializers.Serializer):
    report_type = serializers.CharField(default="dashboard")
    format = serializers.ChoiceField(choices=("xlsx", "pdf"), default="xlsx")
    filters = serializers.DictField(required=False, default=dict)


class DashboardView(generics.GenericAPIView):
    serializer_class = DashboardResponseSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "analytics.management"

    def get(self, request):
        return Response(DashboardQuery().execute())


class SalesReportSerializer(serializers.Serializer):
    monthly_sales = serializers.ListField()
    sales_by_category = serializers.ListField()
    top_products = serializers.ListField()
    customer_segments = serializers.ListField()
    conversion_rate = serializers.FloatField()


class SalesReportView(generics.GenericAPIView):
    serializer_class = SalesReportSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "analytics.management"

    def get(self, request):
        return Response(SalesReportQuery().execute())


class ReportExportView(generics.GenericAPIView):
    serializer_class = ReportExportSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "analytics.management"

    def get_permissions(self):
        self.required_component_action = "view" if self.request.method == "GET" else "edit"
        return super().get_permissions()

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = generate_report.delay(
            serializer.validated_data["report_type"],
            serializer.validated_data["format"],
            serializer.validated_data["filters"],
        )
        return Response({"task_id": task.id, "status": "queued"}, status=202)
