import { pool, query } from '../../config/database';
import {
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  PaginatedResult,
  ShippingAddress,
} from '../../shared/types';

// ============================================================
// Order Repository — Data access layer for orders
// ============================================================

export interface CreateOrderData {
  user_id: string;
  order_number: string;
  items: Array<{
    product_id: string;
    product_name: string;
    product_sku?: string;
    quantity: number;
    unit_price: number;
  }>;
  shipping_address: ShippingAddress;
  payment_method: string;
  shipping_cost: number;
  discount_amount: number;
  subtotal: number;
  total_amount: number;
  notes?: string;
}

export class OrderRepository {
  async findAll(params: {
    page: number;
    limit: number;
    offset: number;
    userId?: string;
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    search?: string;
  }): Promise<PaginatedResult<Order>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.userId) {
      conditions.push(`o.user_id = $${idx++}`);
      values.push(params.userId);
    }

    if (params.status) {
      conditions.push(`o.status = $${idx++}`);
      values.push(params.status);
    }

    if (params.paymentStatus) {
      conditions.push(`o.payment_status = $${idx++}`);
      values.push(params.paymentStatus);
    }

    if (params.search) {
      conditions.push(`(o.order_number ILIKE $${idx} OR u.email ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM orders o
       LEFT JOIN users u ON o.user_id = u.id ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const { rows } = await query<Order>(
      `SELECT o.*,
              u.email as user_email,
              u.first_name as user_first_name,
              u.last_name as user_last_name
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, params.limit, params.offset]
    );

    return {
      data: rows,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async findById(id: string): Promise<Order | null> {
    const { rows } = await query<Order>(
      `SELECT o.*,
              u.email as user_email,
              u.first_name as user_first_name,
              u.last_name as user_last_name
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [id]
    );

    if (!rows[0]) return null;

    // Fetch order items
    const order = rows[0];
    const { rows: items } = await query<OrderItem>(
      `SELECT oi.*, p.images as product_images
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1
       ORDER BY oi.created_at ASC`,
      [id]
    );

    return { ...order, items };
  }

  async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    const { rows } = await query<Order>(
      `SELECT * FROM orders WHERE order_number = $1`,
      [orderNumber]
    );
    if (!rows[0]) return null;
    return this.findById(rows[0].id);
  }

  async create(data: CreateOrderData): Promise<Order> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create order
      const { rows: [order] } = await client.query<Order>(
        `INSERT INTO orders
           (user_id, order_number, status, subtotal, shipping_cost, discount_amount,
            total_amount, tax, shipping, discount, total, shipping_address,
            payment_method, payment_status, notes)
         VALUES ($1,$2,'pending',$3,$4,$5,$6,0,$4,$5,$6,$7,$8,'pending',$9)
         RETURNING *`,
        [
          data.user_id,
          data.order_number,
          data.subtotal,
          data.shipping_cost,
          data.discount_amount,
          data.total_amount,
          JSON.stringify(data.shipping_address),
          data.payment_method,
          data.notes || null,
        ]
      );

      // Create order items
      for (const item of data.items) {
        const subtotal = item.unit_price * item.quantity;
        await client.query(
          `INSERT INTO order_items
             (order_id, product_id, product_name, product_sku, quantity, unit_price, subtotal, total)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
          [
            order.id,
            item.product_id,
            item.product_name,
            item.product_sku || null,
            item.quantity,
            item.unit_price,
            subtotal,
          ]
        );

        // Decrement stock
        const stockResult = await client.query<{ stock: number }>(
          `SELECT stock FROM products WHERE id = $1`,
          [item.product_id]
        );
        const previousStock = stockResult.rows[0]?.stock ?? 0;
        const newStock = Math.max(0, previousStock - item.quantity);

        await client.query(
          `UPDATE products SET stock = GREATEST(0, stock - $1), updated_at = NOW()
           WHERE id = $2`,
          [item.quantity, item.product_id]
        );

        await client.query(
          `INSERT INTO inventory_movements
             (product_id, user_id, type, quantity, previous_stock, new_stock, reason)
           VALUES ($1, $2, 'sale', $3, $4, $5, $6)`,
          [item.product_id, data.user_id, -item.quantity, previousStock, newStock, `Order ${data.order_number}`]
        );
      }

      await client.query('COMMIT');

      // Return full order with items
      return (await this.findById(order.id))!;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateStatus(
    id: string,
    data: {
      status?: OrderStatus;
      payment_status?: PaymentStatus;
      payment_reference?: string;
      notes?: string;
    }
  ): Promise<Order | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.status) { fields.push(`status = $${idx++}`); values.push(data.status); }
    if (data.payment_status) { fields.push(`payment_status = $${idx++}`); values.push(data.payment_status); }
    if (data.payment_reference !== undefined) { fields.push(`payment_reference = $${idx++}`); values.push(data.payment_reference); }
    if (data.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(data.notes); }

    if (fields.length === 0) return null;
    fields.push(`updated_at = NOW()`);
    values.push(id);

    await query(
      `UPDATE orders SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );

    return this.findById(id);
  }

  async getOrderStats(): Promise<Record<string, unknown>> {
    const { rows } = await query<Record<string, unknown>>(
      `SELECT
         COUNT(*) as total_orders,
         COUNT(*) FILTER (WHERE status = 'pending') as pending,
         COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
         COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
         COUNT(*) FILTER (WHERE status = 'processing') as processing,
         COUNT(*) FILTER (WHERE status = 'shipped') as shipped,
         COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
         COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
         COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0) as total_revenue,
         COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid' AND created_at >= date_trunc('month', NOW())), 0) as monthly_revenue
       FROM orders`
    );
    return rows[0];
  }
}
