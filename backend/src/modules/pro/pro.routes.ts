import { Router } from 'express';
import {
  getAllProfiles,
  getMyProfile,
  getBenefits,
  getPendingCount,
  getProfileById,
  requestProAccess,
  approveProRequest,
  rejectProRequest,
  suspendProMember,
} from './pro.controller';
import {
  requestProDto,
  approveProDto,
  rejectProDto,
} from './dto/request-pro.dto';
import { validate } from '../../shared/middleware/validate.middleware';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { adminOnly } from '../../shared/middleware/roles.middleware';

// ============================================================
// PRO Routes — /api/pro
// ============================================================

const router = Router();

// All PRO routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/pro
 * @desc    List all PRO profiles (filterable by status)
 * @access  Admin
 */
router.get('/', adminOnly, getAllProfiles);

router.get('/requests', adminOnly, getAllProfiles);

/**
 * @route   GET /api/pro/me
 * @desc    Get own PRO application status
 * @access  Private (any authenticated user)
 */
router.get('/me', getMyProfile);

/**
 * @route   GET /api/pro/benefits
 * @desc    Get PRO benefits for approved members
 * @access  PRO members
 */
router.get('/benefits', getBenefits);

/**
 * @route   GET /api/pro/pending-count
 * @desc    Get count of pending requests for admin badge
 * @access  Admin
 */
router.get('/pending-count', adminOnly, getPendingCount);

/**
 * @route   GET /api/pro/:id
 * @desc    Get a specific PRO profile
 * @access  Admin
 */
router.get('/:id', adminOnly, getProfileById);

/**
 * @route   POST /api/pro/request
 * @desc    Submit a PRO access request
 * @access  Authenticated users
 */
router.post('/request', (req, _res, next) => {
  req.body.nit = req.body.nit ?? req.body.tax_id;
  next();
}, requestProDto, validate, requestProAccess);

/**
 * @route   POST /api/pro/:id/approve
 * @desc    Approve a PRO request (upgrades user.role to PRO)
 * @access  Admin
 */
router.post('/:id/approve', adminOnly, approveProDto, validate, approveProRequest);

/**
 * @route   POST /api/pro/:id/reject
 * @desc    Reject a PRO request with reason
 * @access  Admin
 */
router.post('/:id/reject', adminOnly, (req, _res, next) => {
  req.body.reason = req.body.reason ?? req.body.rejection_reason;
  next();
}, rejectProDto, validate, rejectProRequest);

/**
 * @route   POST /api/pro/:id/suspend
 * @desc    Suspend an approved PRO member (downgrades to CLIENT)
 * @access  Admin
 */
router.post('/:id/suspend', adminOnly, suspendProMember);

export default router;
