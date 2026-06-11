from django.contrib import admin

from .models import EnvioModel, TrackingEventModel, TransportadoraModel


class TrackingEventInline(admin.TabularInline):
    model = TrackingEventModel
    extra = 0
    readonly_fields = (
        "estado",
        "descripcion",
        "ubicacion",
        "fecha_evento",
        "external_event_id",
        "changed_by",
        "created_at",
    )


@admin.register(TransportadoraModel)
class TransportadoraAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nombre", "proveedor_externo", "soporta_api", "activa")
    list_filter = ("activa", "soporta_api", "proveedor_externo")
    search_fields = ("codigo", "nombre")


@admin.register(EnvioModel)
class EnvioAdmin(admin.ModelAdmin):
    list_display = (
        "pedido",
        "transportadora",
        "numero_guia",
        "estado_envio",
        "fecha_entrega_estimada",
        "updated_at",
    )
    list_filter = ("estado_envio", "transportadora", "proveedor_externo")
    search_fields = ("pedido__number", "numero_guia", "external_shipment_id")
    list_select_related = ("pedido", "transportadora")
    inlines = (TrackingEventInline,)


@admin.register(TrackingEventModel)
class TrackingEventAdmin(admin.ModelAdmin):
    list_display = ("envio", "estado", "ubicacion", "fecha_evento", "changed_by")
    list_filter = ("estado", "fecha_evento")
    search_fields = ("envio__pedido__number", "descripcion", "external_event_id")
    list_select_related = ("envio", "envio__pedido", "changed_by")
