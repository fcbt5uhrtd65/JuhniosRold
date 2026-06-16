from django.contrib import admin

from .models import (
    Attendance,
    EmployeeDocument,
    HRNotification,
    Payroll,
    PayrollItem,
    PerformanceReview,
    VacationRequestApprovalStep,
    VacationRequestAttachment,
    VacationRequestHistory,
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
    list_display = ("request_number", "employee", "request_type", "subtype", "start_date", "end_date", "status", "reviewed_by", "reviewed_at")
    list_filter = ("status", "request_type", "subtype", "start_date")
    search_fields = ("request_number", "employee__employee_code", "employee__first_name", "employee__last_name", "reason", "description")
    list_select_related = ("employee", "reviewed_by")
    date_hierarchy = "start_date"


@admin.register(VacationRequestAttachment)
class VacationRequestAttachmentAdmin(admin.ModelAdmin):
    list_display = ("name", "request", "attachment_type", "uploaded_by", "created_at")
    list_filter = ("attachment_type", "created_at")
    search_fields = ("name", "request__request_number")
    list_select_related = ("request", "uploaded_by")


@admin.register(VacationRequestApprovalStep)
class VacationRequestApprovalStepAdmin(admin.ModelAdmin):
    list_display = ("request", "step", "sequence", "status", "user", "acted_at")
    list_filter = ("step", "status")
    search_fields = ("request__request_number", "comment")
    list_select_related = ("request", "user")


@admin.register(VacationRequestHistory)
class VacationRequestHistoryAdmin(admin.ModelAdmin):
    list_display = ("request", "action", "user", "old_status", "new_status", "created_at")
    list_filter = ("action", "created_at")
    search_fields = ("request__request_number", "comment")
    list_select_related = ("request", "user")


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
    list_display = ("name", "employee", "document_type", "status", "issued_at", "expires_at", "uploaded_by", "uploaded_at")
    list_filter = ("document_type", "status", "expires_at")
    search_fields = ("name", "document_type", "employee__employee_code", "employee__first_name", "observations")
    list_select_related = ("employee", "uploaded_by")


@admin.register(HRNotification)
class HRNotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "employee", "notification_type", "status", "due_date", "created_at")
    list_filter = ("notification_type", "status", "due_date")
    search_fields = ("title", "message", "employee__employee_code", "employee__first_name")
    list_select_related = ("employee", "document", "created_by")
