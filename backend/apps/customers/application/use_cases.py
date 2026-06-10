class GetCustomerPurchaseHistory:
    def execute(self, customer):
        return customer.orders.select_related("customer").prefetch_related("items__product")
