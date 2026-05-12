import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  updateProfile,
  adminUpdateUser,
  changePassword,
  deleteUser,
  getSavedProducts,
  saveProduct,
  unsaveProduct,
} from './user.controller';
import {
  updateUserDto,
  changePasswordDto,
  adminUpdateUserDto,
  uuidParamDto,
} from './dto/update-user.dto';
import { validate } from '../../shared/middleware/validate.middleware';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { adminOnly, ownerOrAdmin } from '../../shared/middleware/roles.middleware';

// ============================================================
// User Routes — /api/users
// ============================================================

const router = Router();

// All user routes require authentication
router.use(authenticate);

router.get('/me', (req, res, next) => {
  req.params.id = req.user!.userId;
  return getUserById(req, res, next);
});

router.patch('/me', updateUserDto, validate, (req, res, next) => {
  req.params.id = req.user!.userId;
  return updateProfile(req, res, next);
});

router.patch('/me/password', (req, _res, next) => {
  req.body.current_password = req.body.current_password ?? req.body.currentPassword;
  req.body.new_password = req.body.new_password ?? req.body.newPassword;
  next();
}, changePasswordDto, validate, (req, res, next) => {
  req.params.id = req.user!.userId;
  return changePassword(req, res, next);
});

router.get('/me/saved', (req, res, next) => {
  req.params.id = req.user!.userId;
  return getSavedProducts(req, res, next);
});

router.post('/me/saved', (req, res, next) => {
  req.params.id = req.user!.userId;
  req.params.productId = req.body.product_id;
  return saveProduct(req, res, next);
});

router.delete('/me/saved/:productId', (req, res, next) => {
  req.params.id = req.user!.userId;
  return unsaveProduct(req, res, next);
});

/**
 * @route   GET /api/users
 * @desc    List all users (paginated, filterable)
 * @access  Admin
 */
router.get('/', adminOnly, getAllUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Get a specific user
 * @access  Admin or Owner
 */
router.get('/:id', uuidParamDto, validate, ownerOrAdmin, getUserById);

/**
 * @route   PATCH /api/users/:id
 * @desc    Update own profile
 * @access  Owner
 */
router.patch('/:id', uuidParamDto, updateUserDto, validate, ownerOrAdmin, updateProfile);

/**
 * @route   PATCH /api/users/:id/admin
 * @desc    Admin update (role, status)
 * @access  Admin
 */
router.patch('/:id/admin', uuidParamDto, adminUpdateUserDto, validate, adminOnly, adminUpdateUser);

router.patch('/:id/role', uuidParamDto, adminUpdateUserDto, validate, adminOnly, adminUpdateUser);

router.patch('/:id/deactivate', uuidParamDto, validate, adminOnly, (req, res, next) => {
  req.body.is_active = false;
  return adminUpdateUser(req, res, next);
});

/**
 * @route   POST /api/users/:id/change-password
 * @desc    Change own password
 * @access  Owner
 */
router.post('/:id/change-password', uuidParamDto, changePasswordDto, validate, ownerOrAdmin, changePassword);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete a user
 * @access  Admin
 */
router.delete('/:id', uuidParamDto, validate, adminOnly, deleteUser);

/**
 * @route   GET /api/users/:id/saved
 * @desc    Get saved/favorited products
 * @access  Owner
 */
router.get('/:id/saved', uuidParamDto, validate, ownerOrAdmin, getSavedProducts);

/**
 * @route   POST /api/users/:id/saved/:productId
 * @desc    Save a product to favorites
 * @access  Owner
 */
router.post('/:id/saved/:productId', ownerOrAdmin, saveProduct);

/**
 * @route   DELETE /api/users/:id/saved/:productId
 * @desc    Remove from saved products
 * @access  Owner
 */
router.delete('/:id/saved/:productId', ownerOrAdmin, unsaveProduct);

export default router;
