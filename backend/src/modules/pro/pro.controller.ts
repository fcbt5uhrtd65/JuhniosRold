import { Request, Response, NextFunction } from 'express';
import { ProService } from './pro.service';
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  getPaginationParams,
} from '../../shared/utils/response';
import { ProStatus } from '../../shared/types';

// ============================================================
// PRO Controller — HTTP layer for Modo PRO program
// ============================================================

const proService = new ProService();

/**
 * GET /api/pro
 * Admin — list all PRO profiles with filters
 */
export const getAllProfiles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const pagination = getPaginationParams(req.query as Record<string, unknown>);
    const status = req.query.status as ProStatus | undefined;
    const search = req.query.search as string | undefined;

    const result = await proService.findAll({ ...pagination, status, search });
    sendPaginated(res, result, 'PRO profiles fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/pro/me
 * Protected — get own PRO profile/status
 */
export const getMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const profile = await proService.getMyProfile(req.user!.userId);
    sendSuccess(res, profile, 'Your PRO profile');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/pro/benefits
 * PRO user — get benefits details
 */
export const getBenefits = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const benefits = await proService.getBenefits(req.user!.userId);
    sendSuccess(res, benefits, 'PRO benefits fetched');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/pro/pending-count
 * Admin — count of pending PRO requests for dashboard badge
 */
export const getPendingCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const count = await proService.getPendingCount();
    sendSuccess(res, { count }, 'Pending PRO requests count');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/pro/:id
 * Admin — get specific PRO profile
 */
export const getProfileById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const profile = await proService.findById(req.params.id);
    sendSuccess(res, profile, 'PRO profile fetched');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/pro/request
 * Protected — submit a PRO access request
 */
export const requestProAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const profile = await proService.requestAccess(req.user!.userId, req.body);
    sendCreated(
      res,
      profile,
      'PRO request submitted! Our team will review it within 2-3 business days.'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/pro/:id/approve
 * Admin — approve a PRO request
 */
export const approveProRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const profile = await proService.approve(
      req.params.id,
      req.user!.userId,
      req.body
    );
    sendSuccess(res, profile, 'PRO request approved — user is now a PRO member! 🎉');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/pro/:id/reject
 * Admin — reject a PRO request
 */
export const rejectProRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const profile = await proService.reject(req.params.id, req.body.reason);
    sendSuccess(res, profile, 'PRO request rejected');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/pro/:id/suspend
 * Admin — suspend an approved PRO member
 */
export const suspendProMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const profile = await proService.suspend(req.params.id, req.body.reason);
    sendSuccess(res, profile, 'PRO member suspended');
  } catch (err) {
    next(err);
  }
};
