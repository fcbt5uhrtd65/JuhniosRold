from django.contrib import admin

from .infrastructure.models import City, Country, State


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ("name", "iso_code", "phone_code", "is_active")
    search_fields = ("name", "iso_code")
    list_filter = ("is_active",)


@admin.register(State)
class StateAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "country", "is_active")
    search_fields = ("name", "code")
    list_filter = ("country", "is_active")
    raw_id_fields = ("country",)


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ("name", "state", "country", "is_active")
    search_fields = ("name",)
    list_filter = ("country", "state", "is_active")
    raw_id_fields = ("state", "country")
