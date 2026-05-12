import { ProductRepository } from './product.repository';
import { Product, ProductCategory, PaginatedResult, UserRole } from '../../shared/types';
import { NotFoundError } from '../../shared/middleware/error.middleware';

// ============================================================
// Product Service — Business logic layer for products
// ============================================================

export class ProductService {
  private repo: ProductRepository;

  constructor() {
    this.repo = new ProductRepository();
  }

  async findAll(
    params: {
      page: number;
      limit: number;
      offset: number;
      category?: ProductCategory;
      search?: string;
      isFeatured?: boolean;
      active?: boolean;
      featured?: boolean;
      stock?: 'low' | 'out' | 'available';
      minPrice?: number;
      maxPrice?: number;
      sortBy?: string;
      sortOrder?: string;
    },
    userRole?: UserRole
  ): Promise<PaginatedResult<Product>> {
    // Non-admin users only see active products
    const isActive = userRole === UserRole.ADMIN ? undefined : true;
    return this.repo.findAll({ ...params, isActive });
  }

  async findById(id: string, userRole?: UserRole): Promise<Product> {
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundError('Product');
    if (!product.is_active && userRole !== UserRole.ADMIN) {
      throw new NotFoundError('Product');
    }
    return product;
  }

  async findBySlug(slug: string, userRole?: UserRole): Promise<Product> {
    const product = await this.repo.findBySlug(slug);
    if (!product) throw new NotFoundError('Product');
    if (!product.is_active && userRole !== UserRole.ADMIN) {
      throw new NotFoundError('Product');
    }
    return product;
  }

  async create(data: Omit<Product, 'id' | 'slug' | 'created_at' | 'updated_at'>): Promise<Product> {
    return this.repo.create(data as any);
  }

  async update(id: string, data: Partial<Product>): Promise<Product> {
    await this.findById(id, UserRole.ADMIN); // Ensure exists
    const updated = await this.repo.update(id, data);
    if (!updated) throw new NotFoundError('Product');
    return updated;
  }

  async updateStock(
    id: string,
    data: { stock?: number; quantity?: number; reason?: string; userId?: string }
  ): Promise<Product> {
    const current = await this.findById(id, UserRole.ADMIN);
    const nextStock =
      data.stock !== undefined
        ? data.stock
        : current.stock + (data.quantity ?? 0);

    const product = await this.repo.updateStock(id, nextStock, data.userId, data.reason);
    if (!product) throw new NotFoundError('Product');
    return product;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new NotFoundError('Product');
  }

  async getLowStock(threshold = 10): Promise<Product[]> {
    return this.repo.getLowStock(threshold);
  }

  async getFeatured(): Promise<Product[]> {
    return this.repo.getFeatured();
  }

  /**
   * Get the correct price for a user based on their role
   */
  getPriceForUser(product: Product, userRole?: UserRole): number {
    if (userRole === UserRole.PRO || userRole === UserRole.DISTRIBUTOR) {
      return product.pro_price;
    }
    return product.price;
  }
}
