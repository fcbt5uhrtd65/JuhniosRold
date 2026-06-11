from django.db import transaction

from shared.domain.exceptions import BusinessRuleViolation

from ..infrastructure.models import InventoryMovement, Stock


class RegisterInventoryMovement:
    POSITIVE_TYPES = {
        InventoryMovement.Type.ENTRY,
        InventoryMovement.Type.ADJUSTMENT_IN,
    }
    NEGATIVE_TYPES = {
        InventoryMovement.Type.EXIT,
        InventoryMovement.Type.LOSS,
        InventoryMovement.Type.ADJUSTMENT_OUT,
    }

    @transaction.atomic
    def execute(
        self,
        *,
        variant,
        location,
        movement_type,
        quantity,
        reason="",
        actor=None,
        reference="",
        consume_reserved=False,
    ):
        if quantity <= 0:
            raise BusinessRuleViolation("La cantidad debe ser mayor que cero.")

        stock, _ = Stock.objects.select_for_update().get_or_create(
            variant=variant,
            location=location,
            defaults={"quantity": 0},
        )
        if movement_type in self.POSITIVE_TYPES:
            stock.quantity += quantity
        elif movement_type in self.NEGATIVE_TYPES:
            if consume_reserved:
                if stock.reserved_quantity < quantity or stock.quantity < quantity:
                    raise BusinessRuleViolation("La reserva de inventario no es suficiente.")
                stock.reserved_quantity -= quantity
            elif stock.available_quantity < quantity:
                raise BusinessRuleViolation("No hay stock suficiente para realizar la salida.")
            stock.quantity -= quantity
        else:
            raise BusinessRuleViolation("Tipo de movimiento no soportado.")

        stock.save(update_fields=("quantity", "reserved_quantity", "updated_at"))
        return InventoryMovement.objects.create(
            variant=variant,
            location=location,
            movement_type=movement_type,
            quantity=quantity,
            reason=reason,
            reference=reference,
            created_by=actor,
        )
