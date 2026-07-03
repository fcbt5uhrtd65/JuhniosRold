from celery.result import AsyncResult
from rest_framework import generics, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.interfaces.permissions import HasComponentAccess

from ..application.queries import DashboardQuery, SalesReportQuery
from ..infrastructure.tasks import export_sales_report, generate_report


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
    top_customers = serializers.ListField()
    customer_geo = serializers.ListField()
    international_customers = serializers.ListField()
    customer_churn = serializers.DictField()


class SalesReportView(generics.GenericAPIView):
    serializer_class = SalesReportSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "analytics.management"

    def get(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        status = request.query_params.get("status")
        client_type = request.query_params.get("client_type")
        return Response(
            SalesReportQuery().execute(
                date_from=date_from, date_to=date_to, status=status, client_type=client_type,
            )
        )


class SalesReportExportSerializer(serializers.Serializer):
    format = serializers.ChoiceField(choices=("xlsx", "pdf"), default="xlsx")
    date_from = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)
    date_to = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)
    status = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)
    client_type = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)


class SalesReportExportView(generics.GenericAPIView):
    serializer_class = SalesReportExportSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "analytics.management"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        task = export_sales_report.delay(
            data["format"], data.get("date_from"), data.get("date_to"), data.get("status"), data.get("client_type"),
        )
        return Response({"task_id": task.id, "status": "queued"}, status=202)


class SalesReportExportStatusView(APIView):
    permission_classes = (HasComponentAccess,)
    required_component = "analytics.management"

    def get(self, request, task_id):
        result = AsyncResult(task_id)
        if result.successful():
            payload = result.result or {}
            return Response({"status": "success", "url": payload.get("url")})
        if result.failed():
            return Response({"status": "failure", "error": str(result.result)})
        return Response({"status": "pending"})


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


class ReportExportStatusView(APIView):
    permission_classes = (HasComponentAccess,)
    required_component = "analytics.management"

    def get(self, request, task_id):
        result = AsyncResult(task_id)
        if result.successful():
            payload = result.result or {}
            return Response({"status": "success", "url": payload.get("url")})
        if result.failed():
            return Response({"status": "failure", "error": str(result.result)})
        return Response({"status": "pending"})
