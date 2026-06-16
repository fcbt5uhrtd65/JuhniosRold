from django.contrib import admin

from .models import (
    Branch,
    Department,
    Employee,
    EmployeeChangeLog,
    EmployeePositionHistory,
    EmployeeSalaryHistory,
    EmploymentContract,
    HRFieldConfiguration,
    Position,
    WorkDay,
)


class PositionInline(admin.TabularInline):
    model = Position
    extra = 0
    fields = ("name", "description", "is_active")


class EmploymentContractInline(admin.TabularInline):
    model = EmploymentContract
    extra = 0
    fields = ("contract_type", "start_date", "end_date", "base_salary", "is_active")


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "city", "department", "is_active", "updated_at")
    list_filter = ("is_active", "city", "department")
    search_fields = ("code", "name", "address", "city", "department")


@admin.register(WorkDay)
class WorkDayAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "sort_order", "is_active")
    list_editable = ("sort_order", "is_active")
    search_fields = ("code", "name")


@admin.register(HRFieldConfiguration)
class HRFieldConfigurationAdmin(admin.ModelAdmin):
    list_display = ("section", "field_name", "label", "is_required", "is_active")
    list_filter = ("section", "is_required", "is_active")
    search_fields = ("field_name", "label", "help_text")


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "description")
    inlines = (PositionInline,)


@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = ("name", "department", "is_active", "updated_at")
    list_filter = ("is_active", "department")
    search_fields = ("name", "description", "department__name")
    list_select_related = ("department",)


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = (
        "employee_code",
        "full_name",
        "document_number",
        "department",
        "position",
        "branch",
        "profile_status",
        "status",
        "hire_date",
        "profile_completion_percentage",
    )
    list_filter = ("status", "profile_status", "department", "position", "branch", "hire_date")
    search_fields = (
        "employee_code",
        "document_number",
        "first_name",
        "last_name",
        "email",
        "phone",
    )
    list_select_related = ("user", "department", "position", "manager", "branch")
    filter_horizontal = ("working_days",)
    date_hierarchy = "hire_date"
    inlines = (EmploymentContractInline,)

    @admin.display(description="Nombre", ordering="first_name")
    def full_name(self, employee):
        return str(employee)


@admin.register(EmploymentContract)
class EmploymentContractAdmin(admin.ModelAdmin):
    list_display = (
        "employee",
        "contract_type",
        "start_date",
        "end_date",
        "base_salary",
        "is_active",
    )
    list_filter = ("contract_type", "is_active", "start_date")
    search_fields = ("employee__employee_code", "employee__first_name", "employee__last_name")
    list_select_related = ("employee",)
    date_hierarchy = "start_date"


@admin.register(EmployeeChangeLog)
class EmployeeChangeLogAdmin(admin.ModelAdmin):
    list_display = ("employee", "field_name", "changed_by", "created_at")
    list_filter = ("field_name", "created_at")
    search_fields = ("employee__employee_code", "employee__first_name", "employee__last_name", "field_name")
    list_select_related = ("employee", "changed_by")


@admin.register(EmployeeSalaryHistory)
class EmployeeSalaryHistoryAdmin(admin.ModelAdmin):
    list_display = ("employee", "previous_salary", "new_salary", "start_date", "changed_by")
    list_filter = ("start_date",)
    search_fields = ("employee__employee_code", "employee__first_name", "employee__last_name")
    list_select_related = ("employee", "changed_by")


@admin.register(EmployeePositionHistory)
class EmployeePositionHistoryAdmin(admin.ModelAdmin):
    list_display = ("employee", "previous_position", "new_position", "start_date", "changed_by")
    list_filter = ("start_date", "new_position")
    search_fields = ("employee__employee_code", "employee__first_name", "employee__last_name")
    list_select_related = ("employee", "previous_position", "new_position", "changed_by")
