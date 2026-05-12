import { InventoryRepository } from './inventory.repository';
import { InventoryMovement, PaginatedResult, Product } from '../../shared/types';
import { NotFoundError } from '../../shared/middleware/error.middleware';

export class InventoryService {
  private repo = new InventoryRepository();

  findAll(params: {
    page: number;
    limit: number;
    offset: number;
    search?: string;
    stock?: 'low' | 'out' | 'available';
  }): Promise<PaginatedResult<Product>> {
    return this.repo.findAll(params);
  }

  getLowStock(): Promise<Product[]> {
    return this.repo.getLowStock();
  }

  async updateStock(data: {
    productId: string;
    stock: number;
    userId: string;
    reason?: string;
  }): Promise<Product> {
    const product = await this.repo.updateStock(data);
    if (!product) throw new NotFoundError('Product');
    return product;
  }

  getMovements(params: {
    page: number;
    limit: number;
    offset: number;
    productId?: string;
    type?: string;
  }): Promise<PaginatedResult<InventoryMovement>> {
    return this.repo.getMovements(params);
  }

  async createMovement(data: {
    productId: string;
    userId: string;
    type: 'adjustment' | 'in' | 'out' | 'sale' | 'return';
    quantity: number;
    reason?: string;
  }): Promise<InventoryMovement> {
    const movement = await this.repo.createMovement(data);
    if (!movement) throw new NotFoundError('Product');
    return movement;
  }
}
