from django.db.models import Count, F, Sum
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
