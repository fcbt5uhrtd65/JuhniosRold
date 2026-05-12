import { AuthRepository } from './auth.repository';
import { hashPassword, comparePassword } from '../../shared/utils/hash';
import { hashToken } from '../../shared/utils/hash';
import { generateTokenPair, verifyRefreshToken } from '../../shared/utils/jwt.utils';
import { SafeUser, UserRole } from '../../shared/types';
import { AppError } from '../../shared/middleware/error.middleware';

// ============================================================
// Auth Service — Business logic layer for authentication
// ============================================================

export interface RegisterInput {
  email: string;
  password: string;
  first_name: string;
  last_name?: string;
  phone?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export class AuthService {
  private repo: AuthRepository;

  constructor() {
    this.repo = new AuthRepository();
  }

  // ---- Register ----
  async register(input: RegisterInput): Promise<AuthResult> {
    const { email, password, first_name, phone } = input;
    const last_name = input.last_name || '';

    // Check email uniqueness
    const exists = await this.repo.emailExists(email);
    if (exists) {
      throw new AppError('Email address is already registered', 409);
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const user = await this.repo.create({
      email,
      password_hash,
      first_name,
      last_name,
      phone,
      role: UserRole.CLIENT,
    });

    const { accessToken, refreshToken } = await this.issueTokenPair(user.id, user.email, user.role);

    // Return safe user (no password_hash)
    const { password_hash: _, ...safeUser } = user;

    return {
      user: safeUser as SafeUser,
      accessToken,
      refreshToken,
      tokens: { accessToken, refreshToken },
    };
  }

  // ---- Login ----
  async login(input: LoginInput): Promise<AuthResult> {
    const { email, password } = input;

    // Find user
    const user = await this.repo.findByEmail(email);
    if (!user) {
      // Use generic message to prevent user enumeration
      throw new AppError('Invalid email or password', 401);
    }

    // Check active status
    if (!user.is_active) {
      throw new AppError('Account is deactivated — please contact support', 403);
    }

    // Verify password
    const passwordValid = await comparePassword(password, user.password_hash);
    if (!passwordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    // Update last login
    await this.repo.updateLastLogin(user.id);

    const { accessToken, refreshToken } = await this.issueTokenPair(user.id, user.email, user.role);

    const { password_hash: _, ...safeUser } = user;

    return {
      user: safeUser as SafeUser,
      accessToken,
      refreshToken,
      tokens: { accessToken, refreshToken },
    };
  }

  // ---- Refresh Token ----
  async refreshTokens(refreshToken: string): Promise<AuthResult['tokens']> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await this.repo.findValidRefreshToken(tokenHash);
    if (!stored || stored.user_id !== payload.userId) {
      throw new AppError('Refresh token has been revoked or is no longer valid', 401);
    }

    // Ensure user still exists and is active
    const user = await this.repo.findById(payload.userId);
    if (!user || !user.is_active) {
      throw new AppError('User not found or deactivated', 401);
    }

    await this.repo.revokeRefreshToken(tokenHash);
    return this.issueTokenPair(user.id, user.email, user.role);
  }

  // ---- Get Current User ----
  async me(userId: string): Promise<SafeUser> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    const { password_hash: _, ...safeUser } = user;
    return safeUser as SafeUser;
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.repo.revokeRefreshToken(hashToken(refreshToken));
      return;
    }
    await this.repo.revokeUserRefreshTokens(userId);
  }

  private async issueTokenPair(
    userId: string,
    email: string,
    role: UserRole
  ): Promise<AuthResult['tokens']> {
    const { accessToken, refreshToken } = generateTokenPair(userId, email, role);
    const payload = verifyRefreshToken(refreshToken);
    const expiresAt = payload.exp ? new Date(payload.exp * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.repo.saveRefreshToken({
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    });

    return { accessToken, refreshToken };
  }
}
