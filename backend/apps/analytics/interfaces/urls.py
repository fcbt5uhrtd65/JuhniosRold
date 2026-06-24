from django.urls import path

from .views import (
    DashboardView,
    ReportExportView,
    ReportExportStatusView,
    SalesReportExportStatusView,
    SalesReportExportView,
    SalesReportView,
)

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("reports/sales/", SalesReportView.as_view(), name="sales-report"),
    path("reports/sales/exports/", SalesReportExportView.as_view(), name="sales-report-export"),
    path(
        "reports/sales/exports/<str:task_id>/",
        SalesReportExportStatusView.as_view(),
        name="sales-report-export-status",
    ),
    path("exports/", ReportExportView.as_view(), name="report-export"),
    path("exports/<str:task_id>/", ReportExportStatusView.as_view(), name="report-export-status"),
]
