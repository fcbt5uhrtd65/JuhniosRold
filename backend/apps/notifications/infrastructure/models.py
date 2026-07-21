from django.conf import settings
from django.db import models

from shared.infrastructure.models import BaseModel


class Notification(BaseModel):
    class Type(models.TextChoices):
        ORDER_CONFIRMED  = "order_confirmed",  "Pedido confirmado"
        ORDER_SHIPPED    = "order_shipped",    "Pedido en camino"
        ORDER_DELIVERED  = "order_delivered",  "Pedido entregado"
        ORDER_CANCELLED  = "order_cancelled",  "Pedido cancelado"
        WHOLESALE_ACTIVATED = "wholesale_activated", "Plan mayorista activado"
        PROMO            = "promo",            "Promoción"
        INFO             = "info",             "Información"

    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    order = models.ForeignKey(
        "commerce.Order",
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    type = models.CharField(max_length=30, choices=Type.choices)
    title = models.CharField(max_length=200)
    message = models.TextField()
    action_url = models.CharField(max_length=500, blank=True)
    read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        indexes = [
            models.Index(fields=["customer", "-created_at"]),
            models.Index(fields=["customer", "read"]),
        ]

    def __str__(self):
        return f"[{self.type}] {self.title} → {self.customer}"


class StaffNotification(BaseModel):
    """Notificación interna dirigida a personal (empleados), separada de
    Notification (orientada a clientes de e-commerce). Se originó en
    apps.human_resources como HRNotification (vencimiento de documentos) y se
    generalizó aquí para que otros módulos (ej. manufacturing) la reutilicen
    en vez de crear un tercer mecanismo de notificación."""

    class NotificationType(models.TextChoices):
        DOCUMENT_EXPIRED = "DOCUMENT_EXPIRED", "Documento vencido"
        DOCUMENT_EXPIRING = "DOCUMENT_EXPIRING", "Documento por vencer"
        MISSING_DOCUMENT = "MISSING_DOCUMENT", "Documento pendiente"
        BATCH_ASSIGNED = "BATCH_ASSIGNED", "Orden asignada"
        DISPENSING_PENDING = "DISPENSING_PENDING", "Dispensación pendiente"
        VERIFICATION_PENDING = "VERIFICATION_PENDING", "Verificación pendiente"
        OUT_OF_SPECIFICATION = "OUT_OF_SPECIFICATION", "Resultado fuera de especificación"
        DOCUMENT_REJECTED = "DOCUMENT_REJECTED", "Documento rechazado"
        SIGNATURE_PENDING = "SIGNATURE_PENDING", "Firma pendiente"
        LINE_CLEARANCE_REJECTED = "LINE_CLEARANCE_REJECTED", "Despeje no conforme"
        RAW_MATERIAL_OUT_OF_TOLERANCE = "RAW_MATERIAL_OUT_OF_TOLERANCE", "Materia prima fuera de tolerancia"
        CERTIFICATE_PENDING = "CERTIFICATE_PENDING", "Certificado de análisis pendiente"
        MICROBIOLOGY_APPROVED = "MICROBIOLOGY_APPROVED", "Microbiología aprobada"
        MICROBIOLOGY_REJECTED = "MICROBIOLOGY_REJECTED", "Microbiología rechazada"
        DOSSIER_INCOMPLETE = "DOSSIER_INCOMPLETE", "Expediente incompleto"
        BATCH_READY_FOR_RELEASE = "BATCH_READY_FOR_RELEASE", "Lote listo para liberación"
        BATCH_RELEASED = "BATCH_RELEASED", "Lote liberado"
        BATCH_REJECTED = "BATCH_REJECTED", "Lote rechazado"
        GENERAL = "GENERAL", "General"

    class Status(models.TextChoices):
        UNREAD = "UNREAD", "Sin leer"
        READ = "READ", "Leída"
        DISMISSED = "DISMISSED", "Descartada"

    module = models.CharField(max_length=40, default="human_resources", db_index=True)
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="staff_notifications",
        null=True,
        blank=True,
    )
    document = models.ForeignKey(
        "human_resources.EmployeeDocument",
        on_delete=models.CASCADE,
        related_name="staff_notifications",
        null=True,
        blank=True,
    )
    batch = models.ForeignKey(
        "manufacturing.Batch",
        on_delete=models.CASCADE,
        related_name="staff_notifications",
        null=True,
        blank=True,
    )
    notification_type = models.CharField(max_length=40, choices=NotificationType.choices)
    title = models.CharField(max_length=180)
    message = models.TextField()
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UNREAD)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_staff_notifications",
    )

    class Meta(BaseModel.Meta):
        indexes = [
            models.Index(fields=["employee", "-created_at"]),
            models.Index(fields=["employee", "status"]),
        ]

    def __str__(self):
        return self.title
