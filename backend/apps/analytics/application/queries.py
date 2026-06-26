from datetime import timedelta

from django.db.models import Count, F, Max, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.commerce.infrastructure.models import Order, OrderItem
from apps.customers.infrastructure.models import Customer
from apps.finance.application.use_cases import GetIncomeVsExpenses
from apps.human_resources.infrastructure.models import Attendance, Payroll
from apps.inventory.infrastructure.models import Stock


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

    def execute(self, date_from: str | None = None, date_to: str | None = None):
        from datetime import date
        today = timezone.localdate()

        def parse(s, fallback):
            try:
                return date.fromisoformat(s)
            except (TypeError, ValueError):
                return fallback

        range_to = parse(date_to, today)
        range_from = parse(date_from, today - timedelta(days=29))

        return {
            "monthly_sales": self._monthly_sales(),
            "sales_by_category": self._sales_by_category(),
            "top_products": self._top_products(),
            "customer_segments": self._customer_segments(),
            "conversion_rate": self._conversion_rate(),
            "top_customers": self._top_customers(),
            "customer_geo": self._customer_geo(),
            "international_customers": self._international_customers(),
            "customer_churn": self._customer_churn(range_from, range_to),
        }

    def _completed_orders(self):
        return Order.objects.exclude(status__in=self.NON_REVENUE_STATUSES)

    def _monthly_sales(self):
        today = timezone.localdate()
        start = (today.replace(day=1) - timedelta(days=30 * (self.MONTHS_BACK - 1))).replace(day=1)
        rows = (
            self._completed_orders()
            .filter(created_at__date__gte=start)
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(total=Sum("total"), orders=Count("id"))
            .order_by("month")
        )
        return [
            {"month": row["month"].strftime("%Y-%m"), "total": row["total"] or 0, "orders": row["orders"]}
            for row in rows
        ]

    def _sales_by_category(self):
        rows = (
            OrderItem.objects.filter(order__in=self._completed_orders())
            .values("variant__product__category__name")
            .annotate(total=Sum("subtotal"))
            .order_by("-total")
        )
        return [
            {"category": row["variant__product__category__name"] or "Sin categoría", "total": row["total"] or 0}
            for row in rows
        ]

    def _top_products(self, limit=5):
        rows = (
            OrderItem.objects.filter(order__in=self._completed_orders())
            .values("variant__product__name")
            .annotate(units=Sum("quantity"), revenue=Sum("subtotal"))
            .order_by("-units")[:limit]
        )
        return [
            {"name": row["variant__product__name"], "units": row["units"], "revenue": row["revenue"] or 0}
            for row in rows
        ]

    def _customers_with_order_stats(self):
        non_revenue_filter = ~Q(orders__status__in=self.NON_REVENUE_STATUSES)
        return Customer.objects.annotate(
            order_count=Count("orders", filter=non_revenue_filter),
            total_spent=Sum("orders__total", filter=non_revenue_filter),
            last_order_at=Max("orders__created_at", filter=non_revenue_filter),
        )

    def _conversion_rate(self):
        customers = list(self._customers_with_order_stats())
        if not customers:
            return 0
        converted = sum(1 for customer in customers if (customer.order_count or 0) > 0)
        return round(converted * 100 / len(customers), 1)

    def _top_customers(self, limit=20):
        today = timezone.localdate()
        inactive_cutoff = today - timedelta(days=self.INACTIVE_DAYS)
        customers = self._customers_with_order_stats()
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

    def _customer_segments(self):
        today = timezone.localdate()
        new_cutoff = today - timedelta(days=self.NEW_CUSTOMER_DAYS)
        inactive_cutoff = today - timedelta(days=self.INACTIVE_DAYS)
        customers = self._customers_with_order_stats()

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

    def _customer_geo(self, limit=10):
        """Top ciudades por número de clientes y por ingresos generados."""
        from apps.customers.infrastructure.models import CustomerAddress
        stats = self._customers_with_order_stats()
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

    def _international_customers(self):
        """Clientes cuya dirección registrada indica país distinto a Colombia."""
        COLOMBIA_VARIANTS = {"colombia", "col", "co"}
        from apps.customers.infrastructure.models import CustomerAddress
        non_revenue_filter = ~Q(orders__status__in=self.NON_REVENUE_STATUSES)
        customers = Customer.objects.annotate(
            order_count=Count("orders", filter=non_revenue_filter),
            total_spent=Sum("orders__total", filter=non_revenue_filter),
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

    def _customer_churn(self, range_from, range_to):
        """
        Retención y churn entre el período actual (range_from..range_to)
        y el período anterior (mismo número de días, inmediatamente anterior).
        """
        period_days = (range_to - range_from).days or 1
        previous_start = range_from - timedelta(days=period_days)
        previous_end = range_from - timedelta(days=1)

        completed = self._completed_orders()
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
