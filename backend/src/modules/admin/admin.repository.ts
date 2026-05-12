import { query } from '../../config/database';

export class AdminRepository {
  async getStats(): Promise<Record<string, unknown>> {
    const { rows } = await query<Record<string, unknown>>(
      `SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM users WHERE is_active = true) AS active_users,
        (SELECT COUNT(*) FROM products) AS total_products,
        (SELECT COUNT(*) FROM products WHERE stock <= min_stock) AS low_stock_products,
        (SELECT COUNT(*) FROM orders) AS total_orders,
        (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS pending_orders,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE payment_status = 'paid') AS total_revenue,
        (SELECT COUNT(*) FROM pro_requests WHERE status = 'pending') AS pending_pro_requests`
    );
    return rows[0];
  }

  async getDashboard(): Promise<Record<string, unknown>> {
    const stats = await this.getStats();
    const recentOrders = await query<Record<string, unknown>>(
      `SELECT o.id, o.order_number, o.status, o.total_amount, o.created_at,
              u.email as user_email, u.name as user_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC
       LIMIT 8`
    );
    const lowStock = await query<Record<string, unknown>>(
      `SELECT id, name, sku, stock, min_stock
       FROM products
       WHERE stock <= min_stock
       ORDER BY stock ASC
       LIMIT 8`
    );

    return {
      stats,
      recent_orders: recentOrders.rows,
      low_stock: lowStock.rows,
    };
  }

  async getReports(): Promise<Record<string, unknown>> {
    const revenueByMonth = await query<Record<string, unknown>>(
      `SELECT * FROM v_revenue_by_month LIMIT 12`
    );
    const productStats = await query<Record<string, unknown>>(
      `SELECT * FROM v_product_stats ORDER BY total_sold DESC, total_revenue DESC LIMIT 20`
    );

    return {
      revenue_by_month: revenueByMonth.rows,
      product_stats: productStats.rows,
    };
  }
}
