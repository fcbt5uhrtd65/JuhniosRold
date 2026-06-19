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

    def execute(self):
        return {
            "monthly_sales": self._monthly_sales(),
            "sales_by_category": self._sales_by_category(),
            "top_products": self._top_products(),
            "customer_segments": self._customer_segments(),
            "conversion_rate": self._conversion_rate(),
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
