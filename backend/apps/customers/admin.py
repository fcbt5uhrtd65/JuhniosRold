from django.contrib import admin

from .models import Customer, CustomerAddress, CustomerContact, CustomerSegment


class CustomerContactInline(admin.TabularInline):
    model = CustomerContact
    extra = 0
    fields = ("name", "relationship", "email", "phone", "is_primary")


class CustomerAddressInline(admin.TabularInline):
    model = CustomerAddress
    extra = 0
    fields = ("address", "city", "state", "country", "latitude", "longitude", "reference", "is_default")


@admin.register(CustomerSegment)
class CustomerSegmentAdmin(admin.ModelAdmin):
    list_display = ("name", "updated_at")
    search_fields = ("name", "description")


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        "document_number",
        "full_name",
        "email",
        "phone",
        "city",
        "is_active",
        "updated_at",
    )
    list_filter = ("is_active", "document_type", "city", "segments")
    search_fields = ("document_number", "first_name", "last_name", "email", "phone")
    filter_horizontal = ("segments",)
    list_select_related = ("user",)
    inlines = (CustomerContactInline, CustomerAddressInline)

    @admin.display(description="Nombre", ordering="first_name")
    def full_name(self, customer):
        return str(customer)


@admin.register(CustomerContact)
class CustomerContactAdmin(admin.ModelAdmin):
    list_display = ("name", "customer", "relationship", "email", "phone", "is_primary")
    list_filter = ("is_primary", "relationship")
    search_fields = ("name", "email", "phone", "customer__document_number")
    list_select_related = ("customer",)
