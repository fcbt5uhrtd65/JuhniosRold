from django.contrib import admin

from .models import (
    Attendance,
    EmployeeDocument,
    Payroll,
    PayrollItem,
    PerformanceReview,
    VacationRequest,
)


class PayrollItemInline(admin.TabularInline):
    model = PayrollItem
    extra = 0
    fields = ("item_type", "concept", "amount")


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("employee", "date", "check_in", "check_out")
    list_filter = ("date",)
    search_fields = ("employee__employee_code", "employee__first_name", "employee__last_name")
    list_select_related = ("employee",)
    date_hierarchy = "date"


@admin.register(VacationRequest)
class VacationRequestAdmin(admin.ModelAdmin):
    list_display = ("employee", "start_date", "end_date", "status", "reviewed_by", "reviewed_at")
    list_filter = ("status", "start_date")
    search_fields = ("employee__employee_code", "employee__first_name", "employee__last_name", "reason")
    list_select_related = ("employee", "reviewed_by")
    date_hierarchy = "start_date"


@admin.register(Payroll)
class PayrollAdmin(admin.ModelAdmin):
    list_display = (
        "employee",
        "period_start",
        "period_end",
        "base_salary",
        "bonuses",
        "deductions",
        "net_salary",
        "status",
    )
    list_filter = ("status", "period_start")
    search_fields = ("employee__employee_code", "employee__first_name", "employee__last_name")
    list_select_related = ("employee",)
    date_hierarchy = "period_start"
    inlines = (PayrollItemInline,)


@admin.register(PayrollItem)
class PayrollItemAdmin(admin.ModelAdmin):
    list_display = ("payroll", "item_type", "concept", "amount")
    list_filter = ("item_type",)
    search_fields = ("concept", "payroll__employee__employee_code")
    list_select_related = ("payroll", "payroll__employee")


@admin.register(PerformanceReview)
class PerformanceReviewAdmin(admin.ModelAdmin):
    list_display = ("employee", "reviewer", "review_date", "score")
    list_filter = ("review_date",)
    search_fields = (
        "employee__employee_code",
        "employee__first_name",
        "employee__last_name",
        "reviewer__email",
        "comments",
    )
    list_select_related = ("employee", "reviewer")
    date_hierarchy = "review_date"


@admin.register(EmployeeDocument)
class EmployeeDocumentAdmin(admin.ModelAdmin):
    list_display = ("name", "employee", "document_type", "expires_at", "updated_at")
    list_filter = ("document_type", "expires_at")
    search_fields = ("name", "document_type", "employee__employee_code", "employee__first_name")
    list_select_related = ("employee",)
