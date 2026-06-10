from rest_framework import generics, serializers
from rest_framework.response import Response

from ..application.queries import DashboardQuery
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

    def get(self, request):
        return Response(DashboardQuery().execute())


class ReportExportView(generics.GenericAPIView):
    serializer_class = ReportExportSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = generate_report.delay(
            serializer.validated_data["report_type"],
            serializer.validated_data["format"],
            serializer.validated_data["filters"],
        )
        return Response({"task_id": task.id, "status": "queued"}, status=202)
