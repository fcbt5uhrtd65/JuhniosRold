from django.urls import path

from .views import DashboardView, ReportExportView

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("exports/", ReportExportView.as_view(), name="report-export"),
]
