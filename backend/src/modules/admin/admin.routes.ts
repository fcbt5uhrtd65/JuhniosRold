import { Router } from 'express';
import { getAdminDashboard, getAdminReports, getAdminStats } from './admin.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { adminOnly } from '../../shared/middleware/roles.middleware';

const router = Router();

router.use(authenticate, adminOnly);

router.get('/stats', getAdminStats);
router.get('/dashboard', getAdminDashboard);
router.get('/reports', getAdminReports);

export default router;
