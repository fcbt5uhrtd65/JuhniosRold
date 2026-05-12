import { query } from '../../config/database';
import {
  ProProfile,
  ProStatus,
  BusinessType,
  PaginatedResult,
} from '../../shared/types';

// ============================================================
// PRO Repository — Data access layer for PRO profiles
// ============================================================

export class ProRepository {
  async findAll(params: {
    page: number;
    limit: number;
    offset: number;
    status?: ProStatus;
    search?: string;
  }): Promise<PaginatedResult<ProProfile & { user_email?: string; user_name?: string }>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.status) {
      conditions.push(`pp.status = $${idx++}`);
      values.push(params.status);
    }

    if (params.search) {
      conditions.push(
        `(pp.business_name ILIKE $${idx} OR u.email ILIKE $${idx})`
      );
      values.push(`%${params.search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM pro_requests pp
       LEFT JOIN users u ON pp.user_id = u.id ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const { rows } = await query<ProProfile & { user_email: string; user_name: string }>(
      `SELECT pp.*, pp.tax_id as nit, pp.reviewed_by as approved_by, pp.reviewed_at as approved_at,
              u.email as user_email,
              CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM pro_requests pp
       LEFT JOIN users u ON pp.user_id = u.id
       ${where}
       ORDER BY pp.created_at DESC
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

  async findById(id: string): Promise<ProProfile | null> {
    const { rows } = await query<ProProfile>(
      `SELECT pp.*, pp.tax_id as nit, pp.reviewed_by as approved_by, pp.reviewed_at as approved_at,
              u.email as user_email,
              CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM pro_requests pp
       LEFT JOIN users u ON pp.user_id = u.id
       WHERE pp.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async findByUserId(userId: string): Promise<ProProfile | null> {
    const { rows } = await query<ProProfile>(
      `SELECT *, tax_id as nit, reviewed_by as approved_by, reviewed_at as approved_at
       FROM pro_requests WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  }

  async create(data: {
    user_id: string;
    business_name: string;
    business_type: BusinessType;
    nit?: string;
    city: string;
    department: string;
    website_url?: string;
    social_media?: Record<string, string>;
    message?: string;
  }): Promise<ProProfile> {
    const { rows } = await query<ProProfile>(
      `INSERT INTO pro_requests
         (user_id, business_name, business_type, tax_id, message, city, department,
          website_url, social_media, status, discount_percentage,
          priority_shipping, early_access, benefits)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending', 15, false, false, '{}')
       RETURNING *, tax_id as nit, reviewed_by as approved_by, reviewed_at as approved_at`,
      [
        data.user_id,
        data.business_name,
        data.business_type,
        data.nit || null,
        data.message || null,
        data.city,
        data.department,
        data.website_url || null,
        JSON.stringify(data.social_media || {}),
      ]
    );
    return rows[0];
  }

  async approve(
    id: string,
    approvedBy: string,
    options: {
      discount_percentage?: number;
      priority_shipping?: boolean;
      early_access?: boolean;
      benefits?: Record<string, unknown>;
    }
  ): Promise<ProProfile | null> {
    const { rows } = await query<ProProfile>(
      `UPDATE pro_requests
       SET status = 'approved',
           reviewed_by = $1,
           reviewed_at = NOW(),
           rejection_reason = NULL,
           discount_percentage = COALESCE($2, discount_percentage),
           priority_shipping = COALESCE($3, priority_shipping),
           early_access = COALESCE($4, early_access),
           benefits = COALESCE($5::jsonb, benefits),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *, tax_id as nit, reviewed_by as approved_by, reviewed_at as approved_at`,
      [
        approvedBy,
        options.discount_percentage ?? null,
        options.priority_shipping ?? null,
        options.early_access ?? null,
        options.benefits ? JSON.stringify(options.benefits) : null,
        id,
      ]
    );
    return rows[0] || null;
  }

  async reject(id: string, reason: string): Promise<ProProfile | null> {
    const { rows } = await query<ProProfile>(
      `UPDATE pro_requests
       SET status = 'rejected', rejection_reason = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *, tax_id as nit, reviewed_by as approved_by, reviewed_at as approved_at`,
      [reason, id]
    );
    return rows[0] || null;
  }

  async suspend(id: string, reason: string): Promise<ProProfile | null> {
    const { rows } = await query<ProProfile>(
      `UPDATE pro_requests
       SET status = 'suspended', rejection_reason = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *, tax_id as nit, reviewed_by as approved_by, reviewed_at as approved_at`,
      [reason, id]
    );
    return rows[0] || null;
  }

  async getPendingCount(): Promise<number> {
    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM pro_requests WHERE status = 'pending'`
    );
    return parseInt(rows[0].count, 10);
  }
}
