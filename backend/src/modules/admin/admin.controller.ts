import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { sendSuccess } from '../../shared/utils/response';

const adminService = new AdminService();

export const getAdminStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await adminService.getStats();
    sendSuccess(res, stats, 'Admin stats fetched successfully');
  } catch (err) {
    next(err);
  }
};

export const getAdminDashboard = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dashboard = await adminService.getDashboard();
    sendSuccess(res, dashboard, 'Admin dashboard fetched successfully');
  } catch (err) {
    next(err);
  }
};

export const getAdminReports = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reports = await adminService.getReports();
    sendSuccess(res, reports, 'Admin reports fetched successfully');
  } catch (err) {
    next(err);
  }
};
