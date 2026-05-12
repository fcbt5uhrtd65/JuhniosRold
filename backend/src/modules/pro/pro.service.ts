import { ProRepository } from './pro.repository';
import { UserRepository } from '../users/user.repository';
import {
  ProProfile,
  ProStatus,
  BusinessType,
  PaginatedResult,
  UserRole,
} from '../../shared/types';
import {
  AppError,
  NotFoundError,
  ForbiddenError,
} from '../../shared/middleware/error.middleware';

// ============================================================
// PRO Service — Business logic for the Modo PRO program
//
// Flow:
//   1. CLIENT registers normally
//   2. CLIENT submits PRO request (POST /api/pro/request)
//   3. ADMIN sees pending requests (GET /api/pro?status=pending)
//   4. ADMIN approves/rejects (POST /api/pro/:id/approve|reject)
//   5. On approval → user.role is updated to PRO
//   6. PRO user gets: discount prices, priority shipping, early access
// ============================================================

export class ProService {
  private proRepo: ProRepository;
  private userRepo: UserRepository;

  constructor() {
    this.proRepo = new ProRepository();
    this.userRepo = new UserRepository();
  }

  // ---- Submit PRO request ----
  async requestAccess(
    userId: string,
    data: {
      business_name: string;
      business_type: BusinessType;
      nit?: string;
      city: string;
      department: string;
      website_url?: string;
      social_media?: Record<string, string>;
      message?: string;
    }
  ): Promise<ProProfile> {
    // Check if user already has a PRO profile
    const existing = await this.proRepo.findByUserId(userId);
    if (existing) {
      if (existing.status === ProStatus.PENDING) {
        throw new AppError('You already have a pending PRO request', 409);
      }
      if (existing.status === ProStatus.APPROVED) {
        throw new AppError('You are already a PRO member', 409);
      }
      if (existing.status === ProStatus.SUSPENDED) {
        throw new AppError('Your PRO account is suspended — contact support', 403);
      }
      // If rejected, allow re-application
    }

    return this.proRepo.create({ user_id: userId, ...data });
  }

  // ---- Get all PRO profiles (admin) ----
  async findAll(params: {
    page: number;
    limit: number;
    offset: number;
    status?: ProStatus;
    search?: string;
  }): Promise<PaginatedResult<ProProfile>> {
    return this.proRepo.findAll(params) as any;
  }

  // ---- Get my PRO profile ----
  async getMyProfile(userId: string): Promise<ProProfile> {
    const profile = await this.proRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('PRO profile');
    }
    return profile;
  }

  // ---- Get PRO profile by ID (admin) ----
  async findById(id: string): Promise<ProProfile> {
    const profile = await this.proRepo.findById(id);
    if (!profile) throw new NotFoundError('PRO profile');
    return profile;
  }

  // ---- Admin: approve PRO request ----
  async approve(
    profileId: string,
    adminId: string,
    options: {
      discount_percentage?: number;
      priority_shipping?: boolean;
      early_access?: boolean;
      benefits?: Record<string, unknown>;
    }
  ): Promise<ProProfile> {
    const profile = await this.findById(profileId);

    if (profile.status === ProStatus.APPROVED) {
      throw new AppError('This PRO profile is already approved', 400);
    }

    if (profile.status === ProStatus.SUSPENDED) {
      throw new AppError('Cannot approve a suspended profile', 400);
    }

    // Update the PRO profile
    const updated = await this.proRepo.approve(profileId, adminId, {
      discount_percentage: options.discount_percentage ?? 15,
      priority_shipping: options.priority_shipping ?? true,
      early_access: options.early_access ?? true,
      benefits: options.benefits ?? {
        free_samples: true,
        dedicated_support: true,
        early_product_access: true,
        marketing_materials: true,
      },
    });

    if (!updated) throw new NotFoundError('PRO profile');

    // Upgrade user role to PRO
    await this.userRepo.update(profile.user_id, { role: UserRole.PRO });

    console.log(`[PRO] User ${profile.user_id} approved as PRO by admin ${adminId}`);

    return updated;
  }

  // ---- Admin: reject PRO request ----
  async reject(profileId: string, reason: string): Promise<ProProfile> {
    const profile = await this.findById(profileId);

    if (profile.status === ProStatus.APPROVED) {
      throw new AppError('Cannot reject an already approved profile — use suspend instead', 400);
    }

    const updated = await this.proRepo.reject(profileId, reason);
    if (!updated) throw new NotFoundError('PRO profile');

    return updated;
  }

  // ---- Admin: suspend PRO member ----
  async suspend(profileId: string, reason: string): Promise<ProProfile> {
    const profile = await this.findById(profileId);

    if (profile.status !== ProStatus.APPROVED) {
      throw new AppError('Only approved PRO members can be suspended', 400);
    }

    const updated = await this.proRepo.suspend(profileId, reason);
    if (!updated) throw new NotFoundError('PRO profile');

    // Downgrade user role back to CLIENT
    await this.userRepo.update(profile.user_id, { role: UserRole.CLIENT });

    return updated;
  }

  // ---- Get PRO benefits for approved user ----
  async getBenefits(userId: string): Promise<Record<string, unknown>> {
    const profile = await this.proRepo.findByUserId(userId);

    if (!profile || profile.status !== ProStatus.APPROVED) {
      throw new ForbiddenError('Only approved PRO members can view benefits');
    }

    return {
      status: profile.status,
      business_name: profile.business_name,
      discount_percentage: profile.discount_percentage,
      priority_shipping: profile.priority_shipping,
      early_access: profile.early_access,
      benefits: profile.benefits,
      approved_at: profile.approved_at,
      member_since: profile.approved_at,
    };
  }

  // ---- Pending count for admin dashboard ----
  async getPendingCount(): Promise<number> {
    return this.proRepo.getPendingCount();
  }
}
