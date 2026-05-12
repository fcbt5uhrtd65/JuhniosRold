import { Router } from 'express';
import {
  getAllProducts,
  getFeaturedProducts,
  getLowStockProducts,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  updateStock,
  deleteProduct,
} from './product.controller';
import { createProductDto } from './dto/create-product.dto';
import { updateProductDto, updateStockDto } from './dto/update-product.dto';
import { validate } from '../../shared/middleware/validate.middleware';
import { authenticate, optionalAuthenticate } from '../../shared/middleware/auth.middleware';
import { adminOnly, staffOnly } from '../../shared/middleware/roles.middleware';

// ============================================================
// Product Routes — /api/products
// ============================================================

const router = Router();

/**
 * @route   GET /api/products
 * @desc    List all products (filtered, paginated)
 * @access  Public (PRO users see pro_price)
 */
router.get('/', optionalAuthenticate, getAllProducts);

/**
 * @route   GET /api/products/featured
 * @desc    Get featured products
 * @access  Public
 */
router.get('/featured', getFeaturedProducts);

/**
 * @route   GET /api/products/low-stock
 * @desc    Get low-stock products for inventory management
 * @access  Admin/Staff
 */
router.get('/low-stock', authenticate, staffOnly, getLowStockProducts);

/**
 * @route   GET /api/products/slug/:slug
 * @desc    Get product by SEO slug
 * @access  Public
 */
router.get('/slug/:slug', optionalAuthenticate, getProductBySlug);

/**
 * @route   GET /api/products/:id
 * @desc    Get a single product by ID
 * @access  Public
 */
router.get('/:id', optionalAuthenticate, getProductById);

/**
 * @route   POST /api/products
 * @desc    Create a new product
 * @access  Admin
 */
router.post('/', authenticate, adminOnly, createProductDto, validate, createProduct);

/**
 * @route   PATCH /api/products/:id
 * @desc    Update product details
 * @access  Admin
 */
router.patch('/:id', authenticate, adminOnly, updateProductDto, validate, updateProduct);

/**
 * @route   PATCH /api/products/:id/stock
 * @desc    Adjust product stock (inventory)
 * @access  Admin/Staff
 */
router.patch('/:id/stock', authenticate, staffOnly, updateStockDto, validate, updateStock);

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete a product
 * @access  Admin
 */
router.delete('/:id', authenticate, adminOnly, deleteProduct);

export default router;
