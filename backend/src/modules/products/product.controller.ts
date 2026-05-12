import { Request, Response, NextFunction } from 'express';
import { ProductService } from './product.service';
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  getPaginationParams,
} from '../../shared/utils/response';
import { ProductCategory } from '../../shared/types';

// ============================================================
// Product Controller — HTTP layer for product management
// ============================================================

const productService = new ProductService();

/**
 * GET /api/products
 * Public — list products (active only for non-admin)
 */
export const getAllProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const pagination = getPaginationParams(req.query as Record<string, unknown>);
    const category = req.query.category as ProductCategory | undefined;
    const search = req.query.search as string | undefined;
    const isFeatured = req.query.featured === 'true' ? true : undefined;
    const active = req.query.active === undefined ? undefined : req.query.active === 'true';
    const stock = req.query.stock as 'low' | 'out' | 'available' | undefined;
    const minPrice = req.query.min_price ? parseFloat(req.query.min_price as string) : undefined;
    const maxPrice = req.query.max_price ? parseFloat(req.query.max_price as string) : undefined;
    const sortBy = (req.query.sortBy || req.query.sort_by) as string | undefined;
    const sortOrder = (req.query.sortOrder || req.query.sort_order) as string | undefined;

    const result = await productService.findAll(
      { ...pagination, category, search, isFeatured, active, stock, minPrice, maxPrice, sortBy, sortOrder },
      req.user?.role
    );
    sendPaginated(res, result, 'Products fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products/featured
 * Public — get featured products for homepage
 */
export const getFeaturedProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const products = await productService.getFeatured();
    sendSuccess(res, products, 'Featured products fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products/low-stock
 * Admin — get products with low stock
 */
export const getLowStockProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const threshold = req.query.threshold ? parseInt(req.query.threshold as string, 10) : 10;
    const products = await productService.getLowStock(threshold);
    sendSuccess(res, products, `Products with stock ≤ ${threshold}`);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products/:id
 * Public — get product by ID
 */
export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const product = await productService.findById(req.params.id, req.user?.role);
    // Attach effective price based on user role
    const effectivePrice = productService.getPriceForUser(product, req.user?.role);
    sendSuccess(res, { ...product, effective_price: effectivePrice }, 'Product fetched');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products/slug/:slug
 * Public — get product by slug (SEO-friendly)
 */
export const getProductBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const product = await productService.findBySlug(req.params.slug, req.user?.role);
    const effectivePrice = productService.getPriceForUser(product, req.user?.role);
    sendSuccess(res, { ...product, effective_price: effectivePrice }, 'Product fetched');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/products
 * Admin — create a product
 */
export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const product = await productService.create(req.body);
    sendCreated(res, product, 'Product created successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/products/:id
 * Admin — update a product
 */
export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const product = await productService.update(req.params.id, req.body);
    sendSuccess(res, product, 'Product updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/products/:id/stock
 * Admin/Staff — adjust product stock
 */
export const updateStock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { quantity, stock, reason } = req.body;
    const product = await productService.updateStock(req.params.id, {
      quantity,
      stock,
      reason,
      userId: req.user!.userId,
    });
    sendSuccess(res, product, 'Stock updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/products/:id
 * Admin — delete a product
 */
export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await productService.delete(req.params.id);
    sendSuccess(res, null, 'Product deleted successfully');
  } catch (err) {
    next(err);
  }
};
