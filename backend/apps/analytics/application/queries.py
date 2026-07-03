from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, F, Max, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.commerce.infrastructure.models import Order, OrderItem
from apps.customers.infrastructure.models import Customer
from apps.finance.application.use_cases import GetIncomeVsExpenses
from apps.human_resources.infrastructure.models import Attendance, Payroll
from apps.inventory.infrastructure.models import (
    InventoryMovement,
    ProductionOrder,
    PurchaseOrder,
    Stock,
)


class DashboardQuery:
    def execute(self):
        today = timezone.localdate()
        completed_orders = Order.objects.exclude(status=Order.Status.CANCELLED)
        return {
            "sales_today": completed_orders.filter(created_at__date=today).aggregate(total=Sum("total"))["total"] or 0,
            "orders_by_status": list(Order.objects.values("status").annotate(total=Count("id")).order_by("status")),
            "top_products": list(
                OrderItem.objects.values("variant__product__name")
                .annotate(units=Sum("quantity"), revenue=Sum("subtotal"))
                .order_by("-units")[:10]
            ),
            "critical_stock": list(
                Stock.objects.filter(quantity__lte=F("minimum_quantity"))
                .values("variant__sku", "variant__product__name", "quantity", "minimum_quantity")[:20]
            ),
            "new_customers": Customer.objects.filter(created_at__date=today).count(),
            "attendance_today": Attendance.objects.filter(date=today, check_in__isnull=False).count(),
            "payroll_expenses": Payroll.objects.aggregate(total=Sum("net_salary"))["total"] or 0,
            "income_vs_expenses": GetIncomeVsExpenses().execute(),
        }


class SalesReportQuery:
    MONTHS_BACK = 6
    VIP_SPEND_THRESHOLD = 1500000
    VIP_ORDERS_THRESHOLD = 10
    RECURRING_ORDERS_THRESHOLD = 2
    NEW_CUSTOMER_DAYS = 30
    INACTIVE_DAYS = 90

    NON_REVENUE_STATUSES = (Order.Status.CANCELLED, Order.Status.RETURNED)

    def execute(
        self,
        date_from: str | None = None,
        date_to: str | None = None,
        status: str | None = None,
        client_type: str | None = None,
    ):
        from datetime import date
        today = timezone.localdate()

        def parse(s, fallback):
            try:
                return date.fromisoformat(s)
            except (TypeError, ValueError):
                return fallback

        range_to = parse(date_to, today)
        range_from = parse(date_from, today - timedelta(days=29))
        status = status if status in Order.Status.values else None
        client_type = client_type if client_type in ("RETAIL", "WHOLESALE") else None

        return {
            "monthly_sales": self._monthly_sales(range_from, range_to, status, client_type),
            "sales_by_category": self._sales_by_category(range_from, range_to, status, client_type),
            "top_products": self._top_products(range_from, range_to, status, client_type),
            "customer_segments": self._customer_segments(range_from, range_to, status, client_type),
            "conversion_rate": self._conversion_rate(range_from, range_to, status, client_type),
            "top_customers": self._top_customers(range_from, range_to, status, client_type),
            "customer_geo": self._customer_geo(range_from, range_to, status, client_type),
            "international_customers": self._international_customers(range_from, range_to, status, client_type),
            "customer_churn": self._customer_churn(range_from, range_to, client_type),
        }

    def _completed_orders(self, range_from=None, range_to=None, status=None, client_type=None):
        qs = Order.objects.all()
        if status:
            qs = qs.filter(status=status)
        else:
            qs = qs.exclude(status__in=self.NON_REVENUE_STATUSES)
        if range_from:
            qs = qs.filter(created_at__date__gte=range_from)
        if range_to:
            qs = qs.filter(created_at__date__lte=range_to)
        if client_type:
            qs = qs.filter(customer__purchase_mode=client_type)
        return qs

    def _monthly_sales(self, range_from, range_to, status, client_type):
        today = timezone.localdate()
        start = (today.replace(day=1) - timedelta(days=30 * (self.MONTHS_BACK - 1))).replace(day=1)
        effective_start = max(start, range_from) if range_from else start
        rows = (
            self._completed_orders(effective_start, range_to, status, client_type)
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(total=Sum("total"), orders=Count("id"))
            .order_by("month")
        )
        return [
            {"month": row["month"].strftime("%Y-%m"), "total": row["total"] or 0, "orders": row["orders"]}
            for row in rows
        ]

    def _sales_by_category(self, range_from, range_to, status, client_type):
        rows = (
            OrderItem.objects.filter(order__in=self._completed_orders(range_from, range_to, status, client_type))
            .values("variant__product__category__name")
            .annotate(total=Sum("subtotal"))
            .order_by("-total")
        )
        return [
            {"category": row["variant__product__category__name"] or "Sin categoría", "total": row["total"] or 0}
            for row in rows
        ]

    def _top_products(self, range_from, range_to, status, client_type, limit=5):
        rows = (
            OrderItem.objects.filter(order__in=self._completed_orders(range_from, range_to, status, client_type))
            .values("variant__product__name")
            .annotate(units=Sum("quantity"), revenue=Sum("subtotal"))
            .order_by("-units")[:limit]
        )
        return [
            {"name": row["variant__product__name"], "units": row["units"], "revenue": row["revenue"] or 0}
            for row in rows
        ]

    def _customers_with_order_stats(self, range_from=None, range_to=None, status=None, client_type=None):
        order_filter = Q()
        if status:
            order_filter &= Q(orders__status=status)
        else:
            order_filter &= ~Q(orders__status__in=self.NON_REVENUE_STATUSES)
        if range_from:
            order_filter &= Q(orders__created_at__date__gte=range_from)
        if range_to:
            order_filter &= Q(orders__created_at__date__lte=range_to)

        qs = Customer.objects.all()
        if client_type:
            qs = qs.filter(purchase_mode=client_type)
        return qs.annotate(
            order_count=Count("orders", filter=order_filter),
            total_spent=Sum("orders__total", filter=order_filter),
            last_order_at=Max("orders__created_at", filter=order_filter),
        )

    def _conversion_rate(self, range_from, range_to, status, client_type):
        customers = list(self._customers_with_order_stats(range_from, range_to, status, client_type))
        if not customers:
            return 0
        converted = sum(1 for customer in customers if (customer.order_count or 0) > 0)
        return round(converted * 100 / len(customers), 1)

    def _top_customers(self, range_from, range_to, status, client_type, limit=20):
        today = timezone.localdate()
        inactive_cutoff = today - timedelta(days=self.INACTIVE_DAYS)
        customers = self._customers_with_order_stats(range_from, range_to, status, client_type)
        result = []
        for customer in customers:
            spent = customer.total_spent or 0
            orders_n = customer.order_count or 0
            if orders_n == 0:
                continue
            if spent >= self.VIP_SPEND_THRESHOLD or orders_n >= self.VIP_ORDERS_THRESHOLD:
                segment = "VIP"
            elif customer.last_order_at and customer.last_order_at.date() < inactive_cutoff:
                segment = "Inactivo"
            elif orders_n >= self.RECURRING_ORDERS_THRESHOLD:
                segment = "Recurrente"
            else:
                segment = "Nuevo"
            result.append({
                "id": str(customer.id),
                "name": f"{customer.first_name} {customer.last_name}".strip(),
                "email": customer.email,
                "phone": customer.phone or "",
                "city": customer.city or "",
                "orders": orders_n,
                "revenue": float(spent),
                "avg_ticket": round(float(spent) / orders_n, 2),
                "last_order": customer.last_order_at.strftime("%Y-%m-%dT%H:%M:%S") if customer.last_order_at else None,
                "segment": segment,
                "mode": customer.purchase_mode or "RETAIL",
            })
        result.sort(key=lambda x: x["revenue"], reverse=True)
        return result[:limit]

    def _customer_segments(self, range_from, range_to, status, client_type):
        today = timezone.localdate()
        new_cutoff = today - timedelta(days=self.NEW_CUSTOMER_DAYS)
        inactive_cutoff = today - timedelta(days=self.INACTIVE_DAYS)
        customers = self._customers_with_order_stats(range_from, range_to, status, client_type)

        counts = {"Nuevos": 0, "VIP": 0, "Recurrentes": 0, "Inactivos": 0}
        for customer in customers:
            spent = customer.total_spent or 0
            orders_n = customer.order_count or 0

            if spent >= self.VIP_SPEND_THRESHOLD or orders_n >= self.VIP_ORDERS_THRESHOLD:
                counts["VIP"] += 1
            elif orders_n == 0:
                if customer.created_at.date() >= new_cutoff:
                    counts["Nuevos"] += 1
                else:
                    counts["Inactivos"] += 1
            elif customer.last_order_at and customer.last_order_at.date() < inactive_cutoff:
                counts["Inactivos"] += 1
            elif orders_n >= self.RECURRING_ORDERS_THRESHOLD:
                counts["Recurrentes"] += 1
            else:
                counts["Nuevos"] += 1

        total = sum(counts.values()) or 1
        return [
            {"segment": name, "count": count, "percentage": round(count * 100 / total, 1)}
            for name, count in counts.items()
        ]

    def _customer_geo(self, range_from, range_to, status, client_type, limit=10):
        """Top ciudades por número de clientes y por ingresos generados."""
        stats = self._customers_with_order_stats(range_from, range_to, status, client_type).filter(order_count__gt=0)
        city_map: dict[str, dict] = {}
        for customer in stats:
            city = (customer.city or "").strip() or "Sin ciudad"
            if city not in city_map:
                city_map[city] = {"city": city, "customers": 0, "revenue": 0.0, "orders": 0}
            city_map[city]["customers"] += 1
            city_map[city]["revenue"] += float(customer.total_spent or 0)
            city_map[city]["orders"] += int(customer.order_count or 0)

        result = sorted(city_map.values(), key=lambda x: x["revenue"], reverse=True)
        total_customers = sum(r["customers"] for r in result) or 1
        for r in result:
            r["percentage"] = round(r["customers"] * 100 / total_customers, 1)
        return result[:limit]

    def _international_customers(self, range_from, range_to, status, client_type):
        """Clientes cuya dirección registrada indica país distinto a Colombia."""
        COLOMBIA_VARIANTS = {"colombia", "col", "co"}
        customers = self._customers_with_order_stats(
            range_from, range_to, status, client_type,
        ).prefetch_related("addresses")

        international = []
        for customer in customers:
            countries = set()
            for addr in customer.addresses.all():
                c = (addr.country or "").strip().lower()
                if c and c not in COLOMBIA_VARIANTS:
                    countries.add(addr.country.strip())
            if not countries:
                if customer.is_international_distributor:
                    countries.add("Internacional")
                else:
                    continue
            international.append({
                "id": str(customer.id),
                "name": f"{customer.first_name} {customer.last_name}".strip(),
                "email": customer.email,
                "countries": sorted(countries),
                "orders": int(customer.order_count or 0),
                "revenue": float(customer.total_spent or 0),
                "is_distributor": customer.is_international_distributor,
                "mode": customer.purchase_mode or "RETAIL",
            })
        international.sort(key=lambda x: x["revenue"], reverse=True)
        return international

    def _customer_churn(self, range_from, range_to, client_type=None):
        """
        Retención y churn entre el período actual (range_from..range_to)
        y el período anterior (mismo número de días, inmediatamente anterior).
        """
        period_days = (range_to - range_from).days or 1
        previous_start = range_from - timedelta(days=period_days)
        previous_end = range_from - timedelta(days=1)

        completed = self._completed_orders(client_type=client_type)
        current_ids = set(
            completed.filter(created_at__date__gte=range_from, created_at__date__lte=range_to)
            .values_list("customer_id", flat=True)
        )
        previous_ids = set(
            completed.filter(created_at__date__gte=previous_start, created_at__date__lte=previous_end)
            .values_list("customer_id", flat=True)
        )

        retained = current_ids & previous_ids
        churned = previous_ids - current_ids
        new_this_period = current_ids - previous_ids

        retention_rate = round(len(retained) * 100 / len(previous_ids), 1) if previous_ids else 0
        churn_rate = round(len(churned) * 100 / len(previous_ids), 1) if previous_ids else 0

        return {
            "current_period_customers": len(current_ids),
            "previous_period_customers": len(previous_ids),
            "retained": len(retained),
            "churned": len(churned),
            "new_this_period": len(new_this_period),
            "retention_rate": retention_rate,
            "churn_rate": churn_rate,
            "period_days": period_days,
        }


class InventoryReportQuery:
    """
    Reportes del módulo de inventario/producción. A diferencia de SalesReportQuery,
    cada método es independiente porque cada reporte de inventario consulta un
    modelo distinto (no hay un "dataset" único subyacente).

    Los filtros `bodega` y `grupo` llegan como texto libre desde el frontend
    (nombres, no IDs) y se aplican con coincidencia parcial (icontains).
    """

    def purchases(self, date_from=None, date_to=None, bodega=None, grupo=None):
        """Órdenes de compra: emitidas, recibidas y pendientes en el período."""
        qs = PurchaseOrder.objects.exclude(status=PurchaseOrder.Status.VOIDED).prefetch_related("lines")
        if date_from:
            qs = qs.filter(issued_at__gte=date_from)
        if date_to:
            qs = qs.filter(issued_at__lte=date_to)
        if bodega:
            qs = qs.filter(destination_location__warehouse__name__icontains=bodega)
        if grupo:
            qs = qs.filter(lines__item__item_group__name__icontains=grupo).distinct()

        rows = []
        for order in qs.select_related("supplier", "destination_location__warehouse"):
            lines = list(order.lines.all())
            ordered_qty = sum((line.quantity for line in lines), Decimal("0"))
            received_qty = sum((line.received_quantity for line in lines), Decimal("0"))
            rows.append({
                "number": order.number,
                "supplier": order.supplier.name,
                "status": order.status,
                "status_label": order.get_status_display(),
                "issued_at": order.issued_at.isoformat(),
                "expected_at": order.expected_at.isoformat() if order.expected_at else None,
                "destination": order.destination_location.warehouse.name if order.destination_location else "Sin bodega",
                "total": float(order.total),
                "ordered_quantity": float(ordered_qty),
                "received_quantity": float(received_qty),
                "pending_quantity": float(ordered_qty - received_qty),
            })
        rows.sort(key=lambda r: r["issued_at"], reverse=True)

        return {
            "orders": rows,
            "summary": {
                "total_orders": len(rows),
                "sent": sum(1 for r in rows if r["status"] == PurchaseOrder.Status.SENT),
                "partial": sum(1 for r in rows if r["status"] == PurchaseOrder.Status.PARTIAL),
                "closed": sum(1 for r in rows if r["status"] == PurchaseOrder.Status.CLOSED),
                "total_value": sum(r["total"] for r in rows),
                "pending_value": sum(
                    r["total"] * (r["pending_quantity"] / r["ordered_quantity"])
                    for r in rows if r["ordered_quantity"]
                ),
            },
        }

    def low_stock(self, bodega=None, grupo=None):
        """Artículos (variantes de producto) cuyo stock actual está bajo el mínimo configurado."""
        qs = Stock.objects.filter(quantity__lte=F("minimum_quantity")).select_related(
            "variant__product", "location__warehouse",
        )
        if bodega:
            qs = qs.filter(location__warehouse__name__icontains=bodega)
        if grupo:
            qs = qs.filter(variant__product__category__name__icontains=grupo)

        rows = [
            {
                "sku": s.variant.sku,
                "product": s.variant.product.name,
                "presentation": s.variant.presentation_label,
                "location": f"{s.location.warehouse.name} / {s.location.name}",
                "quantity": float(s.quantity),
                "minimum_quantity": float(s.minimum_quantity),
                "shortage": float(s.minimum_quantity - s.quantity),
            }
            for s in qs.order_by("variant__product__name")
        ]
        return {"items": rows, "summary": {"total_items": len(rows)}}

    def production(self, date_from=None, date_to=None, grupo=None):
        """
        Órdenes de producción: estado, planeado vs. real en el período.
        Limitación: ProductionOrder no tiene bodega asociada, así que el filtro
        `bodega` no aplica a este reporte. La "merma" no es un campo explícito del
        modelo — se infiere como planned_quantity - actual_quantity en órdenes cerradas.
        """
        qs = ProductionOrder.objects.exclude(status=ProductionOrder.Status.VOIDED).select_related(
            "formula", "output_item",
        )
        # Usa closed_at si la orden ya cerró; si sigue abierta, filtra por started_at.
        if date_from:
            qs = qs.filter(
                Q(closed_at__gte=date_from) | Q(closed_at__isnull=True, started_at__gte=date_from)
            )
        if date_to:
            qs = qs.filter(
                Q(closed_at__lte=date_to) | Q(closed_at__isnull=True, started_at__lte=date_to)
            )
        if grupo:
            qs = qs.filter(output_item__item_group__name__icontains=grupo)

        rows = []
        for order in qs.order_by("-started_at"):
            variance = order.actual_quantity - order.planned_quantity
            rows.append({
                "number": order.number,
                "formula": order.formula.name,
                "output_item": order.output_item.name,
                "status": order.status,
                "status_label": order.get_status_display(),
                "started_at": order.started_at.isoformat() if order.started_at else None,
                "closed_at": order.closed_at.isoformat() if order.closed_at else None,
                "planned_quantity": float(order.planned_quantity),
                "actual_quantity": float(order.actual_quantity),
                "variance": float(variance),
                "yield_percentage": round(float(order.actual_quantity) * 100 / float(order.planned_quantity), 1)
                if order.planned_quantity else 0,
            })

        return {
            "orders": rows,
            "summary": {
                "total_orders": len(rows),
                "closed": sum(1 for r in rows if r["status"] == ProductionOrder.Status.CLOSED),
                "in_progress": sum(1 for r in rows if r["status"] == ProductionOrder.Status.IN_PROGRESS),
                "total_shortage": sum(-r["variance"] for r in rows if r["variance"] < 0),
                "total_surplus": sum(r["variance"] for r in rows if r["variance"] > 0),
            },
        }

    def losses(self, date_from=None, date_to=None, bodega=None, grupo=None):
        """
        Mermas y sobrantes: movimientos de inventario tipo LOSS/ADJUSTMENT en el período.
        Limitación: InventoryMovement no está enlazado a la orden de producción que lo
        originó (el campo `reference` es texto libre), así que esto refleja movimientos
        de inventario en general, no exclusivamente mermas de producción.
        """
        loss_types = (
            InventoryMovement.Type.LOSS,
            InventoryMovement.Type.ADJUSTMENT_IN,
            InventoryMovement.Type.ADJUSTMENT_OUT,
        )
        qs = InventoryMovement.objects.filter(movement_type__in=loss_types).select_related(
            "variant__product", "location__warehouse",
        )
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        if bodega:
            qs = qs.filter(location__warehouse__name__icontains=bodega)
        if grupo:
            qs = qs.filter(variant__product__category__name__icontains=grupo)

        rows = [
            {
                "date": m.created_at.date().isoformat(),
                "product": m.variant.product.name,
                "location": f"{m.location.warehouse.name} / {m.location.name}",
                "type": m.movement_type,
                "type_label": m.get_movement_type_display(),
                "quantity": float(m.quantity),
                "reason": m.reason or "Sin motivo registrado",
            }
            for m in qs.order_by("-created_at")
        ]
        return {
            "movements": rows,
            "summary": {
                "total_movements": len(rows),
                "total_loss": sum(r["quantity"] for r in rows if r["type"] == InventoryMovement.Type.LOSS),
                "total_adjustment_in": sum(r["quantity"] for r in rows if r["type"] == InventoryMovement.Type.ADJUSTMENT_IN),
                "total_adjustment_out": sum(r["quantity"] for r in rows if r["type"] == InventoryMovement.Type.ADJUSTMENT_OUT),
            },
        }

    def stock_at_date(self, cutoff_date, bodega=None, grupo=None):
        """
        Inventario a fecha de corte: reconstruye el stock histórico restando/sumando
        los movimientos de inventario ocurridos DESPUÉS de la fecha de corte al stock actual.
        Limitación: solo es exacto si todos los movimientos de stock pasan por
        InventoryMovement; conversiones de stock (StockConversion) no se reflejan aquí.
        """
        SIGN = {
            InventoryMovement.Type.ENTRY: 1,
            InventoryMovement.Type.ADJUSTMENT_IN: 1,
            InventoryMovement.Type.EXIT: -1,
            InventoryMovement.Type.LOSS: -1,
            InventoryMovement.Type.ADJUSTMENT_OUT: -1,
        }

        stock_qs = Stock.objects.select_related("variant__product", "location__warehouse")
        if bodega:
            stock_qs = stock_qs.filter(location__warehouse__name__icontains=bodega)
        if grupo:
            stock_qs = stock_qs.filter(variant__product__category__name__icontains=grupo)

        later_movements = InventoryMovement.objects.filter(created_at__date__gt=cutoff_date)
        reversal_by_key: dict[tuple, Decimal] = {}
        for movement in later_movements.values("variant_id", "location_id", "movement_type").annotate(
            total=Sum("quantity"),
        ):
            key = (movement["variant_id"], movement["location_id"])
            sign = SIGN.get(movement["movement_type"], 0)
            reversal_by_key[key] = reversal_by_key.get(key, Decimal("0")) + sign * (movement["total"] or Decimal("0"))

        rows = []
        for stock in stock_qs:
            key = (stock.variant_id, stock.location_id)
            reversal = reversal_by_key.get(key, Decimal("0"))
            historical_quantity = stock.quantity - reversal
            rows.append({
                "sku": stock.variant.sku,
                "product": stock.variant.product.name,
                "location": f"{stock.location.warehouse.name} / {stock.location.name}",
                "current_quantity": float(stock.quantity),
                "quantity_at_date": float(historical_quantity),
            })
        rows.sort(key=lambda r: r["product"])

        return {
            "cutoff_date": cutoff_date if isinstance(cutoff_date, str) else cutoff_date.isoformat(),
            "items": rows,
            "summary": {"total_items": len(rows)},
        }

    VAT_RATE = Decimal("0.19")

    def _stock_queryset(self, bodega=None, grupo=None):
        qs = Stock.objects.select_related("variant__product__category", "location__warehouse").prefetch_related("variant__prices")
        if bodega:
            qs = qs.filter(location__warehouse__name__icontains=bodega)
        if grupo:
            qs = qs.filter(variant__product__category__name__icontains=grupo)
        return qs

    def _stock_row(self, stock):
        price = next((p for p in stock.variant.prices.all() if p.is_active), None)
        sale_price = price.amount if price else Decimal("0")
        cost = stock.variant.cost or Decimal("0")
        quantity = stock.quantity
        return {
            "sku": stock.variant.sku,
            "product": stock.variant.product.name,
            "category": stock.variant.product.category.name if stock.variant.product.category else "Sin categoría",
            "warehouse": stock.location.warehouse.name,
            "location": f"{stock.location.warehouse.name} / {stock.location.name}",
            "quantity": float(quantity),
            "unit_cost": float(cost),
            "value_no_vat": float(cost * quantity),
            "value_with_vat": float(cost * quantity * (1 + self.VAT_RATE)),
            "sale_price": float(sale_price),
            "value_at_sale_price": float(sale_price * quantity),
        }

    def stock_general(self, bodega=None, grupo=None):
        """Inventario general: existencias en todas las bodegas con costo y valorización."""
        rows = [self._stock_row(s) for s in self._stock_queryset(bodega, grupo).order_by("variant__product__name")]
        return {
            "items": rows,
            "summary": {
                "total_items": len(rows),
                "total_value_no_vat": sum(r["value_no_vat"] for r in rows),
                "total_value_with_vat": sum(r["value_with_vat"] for r in rows),
                "total_value_at_sale_price": sum(r["value_at_sale_price"] for r in rows),
            },
        }

    def stock_by_warehouse(self, bodega=None, grupo=None):
        """Inventario por bodega: igual que el general, pero agrupado y resumido por bodega."""
        rows = [self._stock_row(s) for s in self._stock_queryset(bodega, grupo).order_by("location__warehouse__name", "variant__product__name")]
        warehouses: dict[str, dict] = {}
        for row in rows:
            w = warehouses.setdefault(row["warehouse"], {"warehouse": row["warehouse"], "items": 0, "total_value_no_vat": 0.0})
            w["items"] += 1
            w["total_value_no_vat"] += row["value_no_vat"]
        return {
            "items": rows,
            "by_warehouse": sorted(warehouses.values(), key=lambda w: w["warehouse"]),
            "summary": {"total_items": len(rows)},
        }

    def stock_by_group(self, bodega=None, grupo=None):
        """Inventario por grupo de artículo (categoría de producto), con subtotales."""
        rows = [self._stock_row(s) for s in self._stock_queryset(bodega, grupo).order_by("variant__product__category__name", "variant__product__name")]
        groups: dict[str, dict] = {}
        for row in rows:
            g = groups.setdefault(row["category"], {"group": row["category"], "items": 0, "total_value_no_vat": 0.0})
            g["items"] += 1
            g["total_value_no_vat"] += row["value_no_vat"]
        return {
            "items": rows,
            "by_group": sorted(groups.values(), key=lambda g: g["group"]),
            "summary": {"total_items": len(rows)},
        }

    def valuation(self, bodega=None, grupo=None):
        """Valorización de inventario: valor total sin IVA, con IVA y a precio de venta."""
        rows = [self._stock_row(s) for s in self._stock_queryset(bodega, grupo).order_by("variant__product__name")]
        return {
            "items": rows,
            "summary": {
                "total_items": len(rows),
                "total_value_no_vat": sum(r["value_no_vat"] for r in rows),
                "total_value_with_vat": sum(r["value_with_vat"] for r in rows),
                "total_value_at_sale_price": sum(r["value_at_sale_price"] for r in rows),
            },
        }

    def movements(self, date_from=None, date_to=None, bodega=None, grupo=None):
        """Movimientos de inventario (entradas y salidas) en el rango de fechas."""
        qs = InventoryMovement.objects.select_related("variant__product", "location__warehouse", "created_by")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        if bodega:
            qs = qs.filter(location__warehouse__name__icontains=bodega)
        if grupo:
            qs = qs.filter(variant__product__category__name__icontains=grupo)

        rows = [
            {
                "date": m.created_at.date().isoformat(),
                "product": m.variant.product.name,
                "location": f"{m.location.warehouse.name} / {m.location.name}",
                "type": m.movement_type,
                "type_label": m.get_movement_type_display(),
                "quantity": float(m.quantity),
                "reason": m.reason or "—",
                "created_by": m.created_by.get_full_name() or m.created_by.email if m.created_by else "Sistema",
            }
            for m in qs.order_by("-created_at")
        ]
        entries = sum(r["quantity"] for r in rows if r["type"] in (InventoryMovement.Type.ENTRY, InventoryMovement.Type.ADJUSTMENT_IN))
        exits = sum(r["quantity"] for r in rows if r["type"] in (InventoryMovement.Type.EXIT, InventoryMovement.Type.LOSS, InventoryMovement.Type.ADJUSTMENT_OUT))
        return {
            "movements": rows,
            "summary": {"total_movements": len(rows), "total_entries": entries, "total_exits": exits},
        }
