import { OrderRepository } from './order.repository';
import { ProductRepository } from '../products/product.repository';
import {
  Order,
  OrderStatus,
  PaymentStatus,
  PaginatedResult,
  ShippingAddress,
  UserRole,
} from '../../shared/types';
import { AppError, NotFoundError, ForbiddenError } from '../../shared/middleware/error.middleware';
import { generateOrderNumber } from '../../shared/utils/response';

// ============================================================
// Order Service — Business logic layer for orders
// ============================================================

const SHIPPING_COST = 8000; // COP — flat rate shipping in Colombia
const FREE_SHIPPING_THRESHOLD = 100000; // COP — free shipping above this

interface OrderItemInput {
  product_id: string;
  quantity: number;
}

interface CreateOrderInput {
  user_id: string;
  items: OrderItemInput[];
  shipping_address: ShippingAddress;
  payment_method: string;
  notes?: string;
  userRole?: UserRole;
}

export class OrderService {
  private orderRepo: OrderRepository;
  private productRepo: ProductRepository;

  constructor() {
    this.orderRepo = new OrderRepository();
    this.productRepo = new ProductRepository();
  }

  // ---- List orders ----
  async findAll(params: {
    page: number;
    limit: number;
    offset: number;
    userId?: string;
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    search?: string;
    requesterId: string;
    requesterRole: UserRole;
  }): Promise<PaginatedResult<Order>> {
    // Admin and seller users can manage all orders; clients and distributors only see their own.
    const canViewAll = [UserRole.ADMIN, UserRole.SELLER].includes(params.requesterRole);
    const userId =
      canViewAll ? params.userId : params.requesterId;

    return this.orderRepo.findAll({ ...params, userId });
  }

  // ---- Get order by ID ----
  async findById(id: string, requesterId: string, requesterRole: UserRole): Promise<Order> {
    const order = await this.orderRepo.findById(id);
    if (!order) throw new NotFoundError('Order');

    // Users can only view their own orders
    if (![UserRole.ADMIN, UserRole.SELLER].includes(requesterRole) && order.user_id !== requesterId) {
      throw new ForbiddenError('You can only view your own orders');
    }

    return order;
  }

  // ---- Create order ----
  async create(input: CreateOrderInput): Promise<Order> {
    const { user_id, items, shipping_address, payment_method, notes, userRole } = input;

    if (!items.length) {
      throw new AppError('Order must contain at least one item', 400);
    }

    // Validate products and compute totals
    let subtotal = 0;
    const resolvedItems: Array<{
      product_id: string;
      product_name: string;
      product_sku?: string;
      quantity: number;
      unit_price: number;
    }> = [];

    for (const item of items) {
      const product = await this.productRepo.findById(item.product_id);

      if (!product || !product.is_active) {
        throw new AppError(`Product not found: ${item.product_id}`, 400);
      }

      if (product.stock < item.quantity) {
        throw new AppError(
          `Insufficient stock for "${product.name}" — available: ${product.stock}`,
          400
        );
      }

      // PRO and DISTRIBUTOR users get pro_price
      const unitPrice =
        userRole === UserRole.PRO || userRole === UserRole.DISTRIBUTOR
          ? product.pro_price
          : product.price;

      subtotal += unitPrice * item.quantity;

      resolvedItems.push({
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        quantity: item.quantity,
        unit_price: unitPrice,
      });
    }

    // Compute shipping
    const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;

    // Compute discount (PRO gets extra 5% discount on top of pro_price)
    let discountAmount = 0;
    if (userRole === UserRole.PRO) {
      discountAmount = Math.round(subtotal * 0.05);
    }

    const totalAmount = subtotal + shippingCost - discountAmount;

    const order = await this.orderRepo.create({
      user_id,
      order_number: generateOrderNumber(),
      items: resolvedItems,
      shipping_address,
      payment_method,
      shipping_cost: shippingCost,
      discount_amount: discountAmount,
      subtotal,
      total_amount: totalAmount,
      notes,
    });

    return order;
  }

  // ---- Update order status (Admin) ----
  async updateStatus(
    orderId: string,
    data: {
      status?: OrderStatus;
      payment_status?: PaymentStatus;
      payment_reference?: string;
      notes?: string;
    },
    requesterId: string,
    requesterRole: UserRole
  ): Promise<Order> {
    const order = await this.findById(orderId, requesterId, requesterRole);

    // Prevent modifying delivered/cancelled orders unless admin
    if (
      requesterRole !== UserRole.ADMIN &&
      (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED)
    ) {
      throw new AppError('Cannot modify a completed or cancelled order', 400);
    }

    const updated = await this.orderRepo.updateStatus(orderId, data);
    if (!updated) throw new NotFoundError('Order');
    return updated;
  }

  // ---- Cancel order (by owner) ----
  async cancel(orderId: string, requesterId: string, requesterRole: UserRole): Promise<Order> {
    const order = await this.findById(orderId, requesterId, requesterRole);

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
      throw new AppError(
        'Only pending or confirmed orders can be cancelled',
        400
      );
    }

    const updated = await this.orderRepo.updateStatus(orderId, {
      status: OrderStatus.CANCELLED,
    });
    return updated!;
  }

  // ---- Stats for admin dashboard ----
  async getStats(): Promise<Record<string, unknown>> {
    return this.orderRepo.getOrderStats();
  }
}
