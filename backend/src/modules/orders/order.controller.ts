import { Request, Response, NextFunction } from 'express';
import { OrderService } from './order.service';
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  getPaginationParams,
} from '../../shared/utils/response';
import { OrderStatus, PaymentStatus } from '../../shared/types';

// ============================================================
// Order Controller — HTTP layer for order management
// ============================================================

const orderService = new OrderService();

/**
 * GET /api/orders
 * Admin — all orders; Client — own orders
 */
export const getAllOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const pagination = getPaginationParams(req.query as Record<string, unknown>);
    const status = req.query.status as OrderStatus | undefined;
    const paymentStatus = req.query.payment_status as PaymentStatus | undefined;
    const search = req.query.search as string | undefined;
    const userId = req.query.user_id as string | undefined;

    const result = await orderService.findAll({
      ...pagination,
      status,
      paymentStatus,
      search,
      userId,
      requesterId: req.user!.userId,
      requesterRole: req.user!.role,
    });

    sendPaginated(res, result, 'Orders fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders/stats
 * Admin — order statistics for dashboard
 */
export const getOrderStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await orderService.getStats();
    sendSuccess(res, stats, 'Order statistics fetched');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders/:id
 * Owner or Admin — get order details with items
 */
export const getOrderById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const order = await orderService.findById(
      req.params.id,
      req.user!.userId,
      req.user!.role
    );
    sendSuccess(res, order, 'Order fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders
 * Protected — create a new order (checkout)
 */
export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const order = await orderService.create({
      ...req.body,
      user_id: req.user!.userId,
      userRole: req.user!.role,
    });
    sendCreated(res, order, 'Order placed successfully! 🎉');
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orders/:id/status
 * Admin — update order and payment status
 */
export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const order = await orderService.updateStatus(
      req.params.id,
      req.body,
      req.user!.userId,
      req.user!.role
    );
    sendSuccess(res, order, 'Order status updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders/:id/cancel
 * Owner — cancel a pending/confirmed order
 */
export const cancelOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const order = await orderService.cancel(
      req.params.id,
      req.user!.userId,
      req.user!.role
    );
    sendSuccess(res, order, 'Order cancelled successfully');
  } catch (err) {
    next(err);
  }
};
