import { UserRepository } from './user.repository';
import { hashPassword, comparePassword } from '../../shared/utils/hash';
import { SafeUser, UserRole, PaginatedResult } from '../../shared/types';
import { AppError, NotFoundError } from '../../shared/middleware/error.middleware';

// ============================================================
// User Service — Business logic layer for users
// ============================================================

export class UserService {
  private repo: UserRepository;

  constructor() {
    this.repo = new UserRepository();
  }

  // ---- Admin: list all users with pagination ----
  async findAll(params: {
    page: number;
    limit: number;
    offset: number;
    role?: UserRole;
    search?: string;
  }): Promise<PaginatedResult<SafeUser>> {
    return this.repo.findAll(params);
  }

  // ---- Get user by ID ----
  async findById(id: string): Promise<SafeUser> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundError('User');
    return user;
  }

  // ---- Update own profile ----
  async updateProfile(
    userId: string,
    data: Partial<{
      first_name: string;
      last_name: string;
      phone: string;
      avatar_url: string;
    }>
  ): Promise<SafeUser> {
    const user = await this.repo.update(userId, data);
    if (!user) throw new NotFoundError('User');
    return user;
  }

  // ---- Admin: update user (includes role, is_active) ----
  async adminUpdate(
    targetId: string,
    requesterId: string,
    data: Partial<{
      first_name: string;
      last_name: string;
      phone: string;
      avatar_url: string;
      role: UserRole;
      is_active: boolean;
    }>
  ): Promise<SafeUser> {
    // Prevent admin from deactivating themselves
    if (targetId === requesterId && data.is_active === false) {
      throw new AppError('You cannot deactivate your own account', 400);
    }

    const user = await this.repo.update(targetId, data);
    if (!user) throw new NotFoundError('User');
    return user;
  }

  // ---- Change password ----
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const hash = await this.repo.getPasswordHash(userId);
    if (!hash) throw new NotFoundError('User');

    const valid = await comparePassword(currentPassword, hash);
    if (!valid) {
      throw new AppError('Current password is incorrect', 400);
    }

    const newHash = await hashPassword(newPassword);
    await this.repo.updatePassword(userId, newHash);
  }

  // ---- Admin: delete user ----
  async delete(userId: string, requesterId: string): Promise<void> {
    if (userId === requesterId) {
      throw new AppError('You cannot delete your own account', 400);
    }
    const deleted = await this.repo.delete(userId);
    if (!deleted) throw new NotFoundError('User');
  }

  // ---- Saved products ----
  async getSavedProducts(userId: string): Promise<Record<string, unknown>[]> {
    return this.repo.getSavedProducts(userId);
  }

  async saveProduct(userId: string, productId: string): Promise<void> {
    return this.repo.saveProduct(userId, productId);
  }

  async unsaveProduct(userId: string, productId: string): Promise<void> {
    const removed = await this.repo.unsaveProduct(userId, productId);
    if (!removed) throw new NotFoundError('Saved product');
  }
}
