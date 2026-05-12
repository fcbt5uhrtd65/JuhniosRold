import { query } from '../../config/database';
import { SafeUser, UserRole, PaginatedResult } from '../../shared/types';

// ============================================================
// User Repository — Data access layer for users
// ============================================================

export class UserRepository {
  private readonly SELECT_SAFE = `
    SELECT id, name, email, first_name, last_name, phone,
           document_type, document_number, company_name, tax_id,
           role, is_active, avatar_url, created_at, updated_at
    FROM users
  `;

  async findAll(params: {
    page: number;
    limit: number;
    offset: number;
    role?: UserRole;
    search?: string;
  }): Promise<PaginatedResult<SafeUser>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.role) {
      conditions.push(`role = $${idx++}`);
      values.push(params.role);
    }

    if (params.search) {
      conditions.push(
        `(email ILIKE $${idx} OR name ILIKE $${idx} OR first_name ILIKE $${idx} OR last_name ILIKE $${idx})`
      );
      values.push(`%${params.search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Fetch page
    const { rows } = await query<SafeUser>(
      `${this.SELECT_SAFE} ${where}
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

  async findById(id: string): Promise<SafeUser | null> {
    const { rows } = await query<SafeUser>(
      `${this.SELECT_SAFE} WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async findByEmail(email: string): Promise<SafeUser | null> {
    const { rows } = await query<SafeUser>(
      `${this.SELECT_SAFE} WHERE email = $1`,
      [email]
    );
    return rows[0] || null;
  }

  async update(
    id: string,
    data: Partial<{
      first_name: string;
      last_name: string;
      phone: string;
      avatar_url: string;
      name: string;
      document_type: string;
      document_number: string;
      company_name: string;
      tax_id: string;
      role: UserRole;
      is_active: boolean;
    }>
  ): Promise<SafeUser | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }
    });

    if (fields.length === 0) return null;

    if (data.first_name !== undefined || data.last_name !== undefined) {
      fields.push(`name = CONCAT_WS(' ', first_name, last_name)`);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await query<SafeUser>(
      `UPDATE users SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING id, name, email, first_name, last_name, phone,
                 document_type, document_number, company_name, tax_id,
                 role, is_active, avatar_url, created_at, updated_at`,
      values
    );
    return rows[0] || null;
  }

  async updatePassword(id: string, password_hash: string): Promise<void> {
    await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [password_hash, id]
    );
  }

  async getPasswordHash(id: string): Promise<string | null> {
    const { rows } = await query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [id]
    );
    return rows[0]?.password_hash || null;
  }

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await query(
      `DELETE FROM users WHERE id = $1`,
      [id]
    );
    return (rowCount ?? 0) > 0;
  }

  async getSavedProducts(userId: string): Promise<Record<string, unknown>[]> {
    const { rows } = await query<Record<string, unknown>>(
      `SELECT sp.id, sp.created_at,
              p.id as product_id, p.name, p.slug, p.price, p.pro_price,
              p.images, p.category, p.is_active
       FROM saved_products sp
       JOIN products p ON sp.product_id = p.id
       WHERE sp.user_id = $1
       ORDER BY sp.created_at DESC`,
      [userId]
    );
    return rows;
  }

  async saveProduct(userId: string, productId: string): Promise<void> {
    await query(
      `INSERT INTO saved_products (user_id, product_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, product_id) DO NOTHING`,
      [userId, productId]
    );
  }

  async unsaveProduct(userId: string, productId: string): Promise<boolean> {
    const { rowCount } = await query(
      `DELETE FROM saved_products WHERE user_id = $1 AND product_id = $2`,
      [userId, productId]
    );
    return (rowCount ?? 0) > 0;
  }
}
