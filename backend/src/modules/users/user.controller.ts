import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import {
  sendSuccess,
  sendPaginated,
  getPaginationParams,
} from '../../shared/utils/response';
import { UserRole } from '../../shared/types';

// ============================================================
// User Controller — HTTP layer for user management
// ============================================================

const userService = new UserService();

/**
 * GET /api/users
 * Admin — list all users with pagination and filters
 */
export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const pagination = getPaginationParams(req.query as Record<string, unknown>);
    const role = req.query.role as UserRole | undefined;
    const search = req.query.search as string | undefined;

    const result = await userService.findAll({ ...pagination, role, search });
    sendPaginated(res, result, 'Users fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id
 * Admin or owner — get user by ID
 */
export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await userService.findById(req.params.id);
    sendSuccess(res, user, 'User fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/users/:id
 * Owner — update own profile (name, phone, avatar)
 */
export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { first_name, last_name, phone, avatar_url } = req.body;
    const user = await userService.updateProfile(req.params.id, {
      first_name,
      last_name,
      phone,
      avatar_url,
    });
    sendSuccess(res, user, 'Profile updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/users/:id/admin
 * Admin — update any user including role and status
 */
export const adminUpdateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await userService.adminUpdate(
      req.params.id,
      req.user!.userId,
      req.body
    );
    sendSuccess(res, user, 'User updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users/:id/change-password
 * Owner — change own password
 */
export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { current_password, new_password } = req.body;
    await userService.changePassword(req.params.id, current_password, new_password);
    sendSuccess(res, null, 'Password changed successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users/:id
 * Admin — delete a user
 */
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await userService.delete(req.params.id, req.user!.userId);
    sendSuccess(res, null, 'User deleted successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id/saved
 * Owner — get saved/favorited products
 */
export const getSavedProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const products = await userService.getSavedProducts(req.params.id);
    sendSuccess(res, products, 'Saved products fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users/:id/saved/:productId
 * Owner — save a product
 */
export const saveProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await userService.saveProduct(req.params.id, req.params.productId);
    sendSuccess(res, null, 'Product saved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users/:id/saved/:productId
 * Owner — remove a saved product
 */
export const unsaveProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await userService.unsaveProduct(req.params.id, req.params.productId);
    sendSuccess(res, null, 'Product removed from saved list');
  } catch (err) {
    next(err);
  }
};
