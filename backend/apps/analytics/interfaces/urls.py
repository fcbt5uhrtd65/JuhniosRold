from django.urls import path

from .views import DashboardView, ReportExportView, SalesReportView

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("reports/sales/", SalesReportView.as_view(), name="sales-report"),
    path("exports/", ReportExportView.as_view(), name="report-export"),
]
