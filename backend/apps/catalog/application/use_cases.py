class ActivateProduct:
    def execute(self, product):
        product.is_active = True
        product.save(update_fields=("is_active", "updated_at"))
        return product


class DeactivateProduct:
    def execute(self, product):
        product.is_active = False
        product.save(update_fields=("is_active", "updated_at"))
        return product
