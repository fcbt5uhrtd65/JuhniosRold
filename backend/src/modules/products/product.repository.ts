import { query, withTransaction } from '../../config/database';
import { Product, ProductCategory, PaginatedResult } from '../../shared/types';
import { slugify } from '../../shared/utils/response';

// ============================================================
// Product Repository - Data access layer for products
// ============================================================

export class ProductRepository {
  async findAll(params: {
    page: number;
    limit: number;
    offset: number;
    category?: ProductCategory;
    search?: string;
    isActive?: boolean;
    active?: boolean;
    isFeatured?: boolean;
    featured?: boolean;
    stock?: 'low' | 'out' | 'available';
    minPrice?: number;
    maxPrice?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<PaginatedResult<Product>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.category) {
      conditions.push(`category = $${idx++}`);
      values.push(params.category);
    }

    const active = params.active ?? params.isActive;
    if (active !== undefined) {
      conditions.push(`COALESCE(active, is_active) = $${idx++}`);
      values.push(active);
    }

    const featured = params.featured ?? params.isFeatured;
    if (featured !== undefined) {
      conditions.push(`COALESCE(featured, is_featured) = $${idx++}`);
      values.push(featured);
    }

    if (params.stock === 'low') {
      conditions.push(`stock > 0 AND stock <= min_stock`);
    } else if (params.stock === 'out') {
      conditions.push(`stock = 0`);
    } else if (params.stock === 'available') {
      conditions.push(`stock > min_stock`);
    }

    if (params.search) {
      conditions.push(
        `(name ILIKE $${idx} OR description ILIKE $${idx} OR slug ILIKE $${idx} OR sku ILIKE $${idx})`
      );
      values.push(`%${params.search}%`);
      idx++;
    }

    if (params.minPrice !== undefined) {
      conditions.push(`price >= $${idx++}`);
      values.push(params.minPrice);
    }

    if (params.maxPrice !== undefined) {
      conditions.push(`price <= $${idx++}`);
      values.push(params.maxPrice);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumns: Record<string, string> = {
      name: 'name',
      category: 'category',
      price: 'price',
      stock: 'stock',
      created_at: 'created_at',
      updated_at: 'updated_at',
      featured: 'featured',
    };
    const sortColumn = sortColumns[params.sortBy || ''] || 'featured';
    const sortOrder = params.sortOrder?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const secondarySort = sortColumn === 'created_at' ? 'id ASC' : 'created_at DESC';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM products ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const { rows } = await query<Product>(
      `SELECT * FROM products ${where}
       ORDER BY ${sortColumn} ${sortOrder}, ${secondarySort}
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

  async findById(id: string): Promise<Product | null> {
    const { rows } = await query<Product>(`SELECT * FROM products WHERE id = $1`, [id]);
    return rows[0] || null;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const { rows } = await query<Product>(`SELECT * FROM products WHERE slug = $1`, [slug]);
    return rows[0] || null;
  }

  async create(data: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    const slug = await this.generateUniqueSlug(data.name);
    const imageUrl = data.image_url || data.images?.[0] || null;
    const isActive = data.active ?? data.is_active ?? true;
    const isFeatured = data.featured ?? data.is_featured ?? false;

    const { rows } = await query<Product>(
      `INSERT INTO products
         (name, slug, description, short_description, category, type, presentation,
          price, wholesale_price, pro_price, stock, min_stock, location, lot, sku,
          image_url, images, ingredients, benefits, how_to_use, weight_ml,
          active, featured, is_active, is_featured, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       RETURNING *`,
      [
        data.name,
        slug,
        data.description,
        data.short_description || null,
        data.category,
        data.type || null,
        data.presentation || null,
        data.price,
        data.wholesale_price ?? data.pro_price ?? data.price * 0.85,
        data.pro_price ?? data.wholesale_price ?? data.price * 0.85,
        data.stock ?? 0,
        data.min_stock ?? 10,
        data.location || 'Bodega Principal',
        data.lot || null,
        data.sku || null,
        imageUrl,
        JSON.stringify(data.images || (imageUrl ? [imageUrl] : [])),
        data.ingredients || [],
        data.benefits || [],
        data.how_to_use || null,
        data.weight_ml || null,
        isActive,
        isFeatured,
        isActive,
        isFeatured,
        data.tags || [],
      ]
    );
    return rows[0];
  }

  async update(id: string, data: Partial<Product>): Promise<Product | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const updatableFields = [
      'name', 'description', 'short_description', 'category', 'type', 'presentation',
      'price', 'wholesale_price', 'pro_price', 'stock', 'min_stock', 'location',
      'lot', 'sku', 'image_url', 'images', 'ingredients', 'benefits', 'how_to_use',
      'weight_ml', 'active', 'featured', 'is_active', 'is_featured', 'tags',
    ];

    for (const field of updatableFields) {
      const value = (data as Record<string, unknown>)[field];
      if (value !== undefined) {
        fields.push(`${field} = $${idx++}`);
        values.push(field === 'images' ? JSON.stringify(value) : value);
      }
    }

    if (data.is_active !== undefined && data.active === undefined) {
      fields.push(`active = $${idx++}`);
      values.push(data.is_active);
    }
    if (data.active !== undefined && data.is_active === undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(data.active);
    }
    if (data.is_featured !== undefined && data.featured === undefined) {
      fields.push(`featured = $${idx++}`);
      values.push(data.is_featured);
    }
    if (data.featured !== undefined && data.is_featured === undefined) {
      fields.push(`is_featured = $${idx++}`);
      values.push(data.featured);
    }
    if (data.images?.length && data.image_url === undefined) {
      fields.push(`image_url = $${idx++}`);
      values.push(data.images[0]);
    }

    if (data.name) {
      const newSlug = await this.generateUniqueSlug(data.name, id);
      fields.push(`slug = $${idx++}`);
      values.push(newSlug);
    }

    if (fields.length === 0) return null;
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await query<Product>(
      `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0] || null;
  }

  async updateStock(
    id: string,
    stock: number,
    userId?: string,
    reason = 'Manual stock update',
    type: 'adjustment' | 'in' | 'out' | 'sale' | 'return' = 'adjustment'
  ): Promise<Product | null> {
    return withTransaction(async (client) => {
      const current = await client.query<Product>(
        `SELECT * FROM products WHERE id = $1 FOR UPDATE`,
        [id]
      );
      const product = current.rows[0];
      if (!product) return null;

      const nextStock = Math.max(0, stock);
      const quantity = nextStock - product.stock;

      const updated = await client.query<Product>(
        `UPDATE products
         SET stock = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [nextStock, id]
      );

      await client.query(
        `INSERT INTO inventory_movements
           (product_id, user_id, type, quantity, previous_stock, new_stock, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, userId || null, type, quantity, product.stock, nextStock, reason]
      );

      return updated.rows[0] || null;
    });
  }

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await query(`DELETE FROM products WHERE id = $1`, [id]);
    return (rowCount ?? 0) > 0;
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const { rows } = await query<{ count: string }>(
      excludeId
        ? `SELECT COUNT(*) as count FROM products WHERE slug = $1 AND id != $2`
        : `SELECT COUNT(*) as count FROM products WHERE slug = $1`,
      excludeId ? [slug, excludeId] : [slug]
    );
    return parseInt(rows[0].count, 10) > 0;
  }

  private async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
    const slug = slugify(name);
    let counter = 0;
    let candidate = slug;

    while (await this.slugExists(candidate, excludeId)) {
      counter++;
      candidate = `${slug}-${counter}`;
    }

    return candidate;
  }

  async getLowStock(threshold?: number): Promise<Product[]> {
    const { rows } = await query<Product>(
      threshold
        ? `SELECT * FROM products WHERE stock <= $1 AND COALESCE(active, is_active) = true ORDER BY stock ASC`
        : `SELECT * FROM products WHERE stock <= min_stock AND COALESCE(active, is_active) = true ORDER BY stock ASC`,
      threshold ? [threshold] : []
    );
    return rows;
  }

  async getFeatured(limit = 8): Promise<Product[]> {
    const { rows } = await query<Product>(
      `SELECT * FROM products
       WHERE COALESCE(featured, is_featured) = true AND COALESCE(active, is_active) = true
       ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  }
}
