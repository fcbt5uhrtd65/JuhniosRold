import { query } from '../../config/database';
import { User, UserRole } from '../../shared/types';

// ============================================================
// Auth Repository — Data access layer for authentication
// ============================================================

export class AuthRepository {
  /**
   * Find a user by email (includes password_hash for auth checks)
   */
  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await query<User>(
      `SELECT id, name, email, password_hash, first_name, last_name,
              phone, document_type, document_number, company_name, tax_id,
              role, is_active, avatar_url, created_at, updated_at
       FROM users
       WHERE email = $1`,
      [email]
    );
    return rows[0] || null;
  }

  /**
   * Find a user by ID (includes password_hash for internal use)
   */
  async findById(id: string): Promise<User | null> {
    const { rows } = await query<User>(
      `SELECT id, name, email, password_hash, first_name, last_name,
              phone, document_type, document_number, company_name, tax_id,
              role, is_active, avatar_url, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Create a new user (CLIENT role by default)
   */
  async create(data: {
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    phone?: string;
    role?: UserRole;
  }): Promise<User> {
    const { rows } = await query<User>(
      `INSERT INTO users (name, email, password_hash, first_name, last_name, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, password_hash, first_name, last_name,
                 phone, document_type, document_number, company_name, tax_id,
                 role, is_active, avatar_url, created_at, updated_at`,
      [
        `${data.first_name} ${data.last_name}`.trim(),
        data.email,
        data.password_hash,
        data.first_name,
        data.last_name,
        data.phone || null,
        data.role || UserRole.CLIENT,
      ]
    );
    return rows[0];
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await query(
      `UPDATE users SET updated_at = NOW() WHERE id = $1`,
      [userId]
    );
  }

  /**
   * Check if email already exists
   */
  async emailExists(email: string): Promise<boolean> {
    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users WHERE email = $1`,
      [email]
    );
    return parseInt(rows[0].count, 10) > 0;
  }

  async saveRefreshToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [data.userId, data.tokenHash, data.expiresAt]
    );
  }

  async findValidRefreshToken(tokenHash: string): Promise<{ id: string; user_id: string } | null> {
    const { rows } = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id
       FROM refresh_tokens
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()`,
      [tokenHash]
    );
    return rows[0] || null;
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash]
    );
  }

  async revokeUserRefreshTokens(userId: string): Promise<void> {
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  }
}
