from django.contrib import admin

from .models import Department, Employee, EmploymentContract, Position


class PositionInline(admin.TabularInline):
    model = Position
    extra = 0
    fields = ("name", "description", "is_active")


class EmploymentContractInline(admin.TabularInline):
    model = EmploymentContract
    extra = 0
    fields = ("contract_type", "start_date", "end_date", "base_salary", "is_active")


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
        "status",
        "hire_date",
    )
    list_filter = ("status", "department", "position", "hire_date")
    search_fields = (
        "employee_code",
        "document_number",
        "first_name",
        "last_name",
        "email",
        "phone",
    )
    list_select_related = ("user", "department", "position", "manager")
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
