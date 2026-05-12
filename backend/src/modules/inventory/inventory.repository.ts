import { query, withTransaction } from '../../config/database';
import { InventoryMovement, PaginatedResult, Product } from '../../shared/types';

export class InventoryRepository {
  async findAll(params: {
    page: number;
    limit: number;
    offset: number;
    search?: string;
    stock?: 'low' | 'out' | 'available';
  }): Promise<PaginatedResult<Product>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.search) {
      conditions.push(`(name ILIKE $${idx} OR sku ILIKE $${idx} OR location ILIKE $${idx} OR lot ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    if (params.stock === 'low') conditions.push(`stock > 0 AND stock <= min_stock`);
    if (params.stock === 'out') conditions.push(`stock = 0`);
    if (params.stock === 'available') conditions.push(`stock > min_stock`);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await query<{ count: string }>(`SELECT COUNT(*) as count FROM products ${where}`, values);
    const total = parseInt(count.rows[0].count, 10);
    const { rows } = await query<Product>(
      `SELECT * FROM products ${where}
       ORDER BY stock ASC, name ASC
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

  async getLowStock(): Promise<Product[]> {
    const { rows } = await query<Product>(
      `SELECT * FROM products
       WHERE stock <= min_stock AND COALESCE(active, is_active) = true
       ORDER BY stock ASC, name ASC`
    );
    return rows;
  }

  async updateStock(data: {
    productId: string;
    stock: number;
    userId: string;
    reason?: string;
  }): Promise<Product | null> {
    return withTransaction(async (client) => {
      const current = await client.query<Product>(
        `SELECT * FROM products WHERE id = $1 FOR UPDATE`,
        [data.productId]
      );
      const product = current.rows[0];
      if (!product) return null;

      const nextStock = Math.max(0, data.stock);
      const quantity = nextStock - product.stock;
      const updated = await client.query<Product>(
        `UPDATE products SET stock = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [nextStock, data.productId]
      );

      await client.query(
        `INSERT INTO inventory_movements
           (product_id, user_id, type, quantity, previous_stock, new_stock, reason)
         VALUES ($1, $2, 'adjustment', $3, $4, $5, $6)`,
        [data.productId, data.userId, quantity, product.stock, nextStock, data.reason || 'Inventory update']
      );

      return updated.rows[0] || null;
    });
  }

  async getMovements(params: {
    page: number;
    limit: number;
    offset: number;
    productId?: string;
    type?: string;
  }): Promise<PaginatedResult<InventoryMovement>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.productId) {
      conditions.push(`product_id = $${idx++}`);
      values.push(params.productId);
    }
    if (params.type) {
      conditions.push(`type = $${idx++}`);
      values.push(params.type);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM inventory_movements ${where}`,
      values
    );
    const total = parseInt(count.rows[0].count, 10);
    const { rows } = await query<InventoryMovement>(
      `SELECT * FROM inventory_movements ${where}
       ORDER BY created_at DESC
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

  async createMovement(data: {
    productId: string;
    userId: string;
    type: 'adjustment' | 'in' | 'out' | 'sale' | 'return';
    quantity: number;
    reason?: string;
  }): Promise<InventoryMovement | null> {
    return withTransaction(async (client) => {
      const current = await client.query<Product>(
        `SELECT * FROM products WHERE id = $1 FOR UPDATE`,
        [data.productId]
      );
      const product = current.rows[0];
      if (!product) return null;

      const signedQuantity = ['out', 'sale'].includes(data.type)
        ? -Math.abs(data.quantity)
        : Math.abs(data.quantity);
      const newStock = Math.max(0, product.stock + signedQuantity);

      await client.query(
        `UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2`,
        [newStock, data.productId]
      );

      const movement = await client.query<InventoryMovement>(
        `INSERT INTO inventory_movements
           (product_id, user_id, type, quantity, previous_stock, new_stock, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [data.productId, data.userId, data.type, signedQuantity, product.stock, newStock, data.reason || null]
      );

      return movement.rows[0] || null;
    });
  }
}
