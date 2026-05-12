import { Request, Response, NextFunction } from 'express';
import { InventoryService } from './inventory.service';
import { getPaginationParams, sendCreated, sendPaginated, sendSuccess } from '../../shared/utils/response';

const inventoryService = new InventoryService();

export const getInventory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pagination = getPaginationParams(req.query as Record<string, unknown>);
    const search = req.query.search as string | undefined;
    const stock = req.query.stock as 'low' | 'out' | 'available' | undefined;
    const result = await inventoryService.findAll({ ...pagination, search, stock });
    sendPaginated(res, result, 'Inventory fetched successfully');
  } catch (err) {
    next(err);
  }
};

export const getLowStock = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const products = await inventoryService.getLowStock();
    sendSuccess(res, products, 'Low-stock products fetched successfully');
  } catch (err) {
    next(err);
  }
};

export const updateInventoryStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await inventoryService.updateStock({
      productId: req.params.productId,
      stock: Number(req.body.stock),
      reason: req.body.reason,
      userId: req.user!.userId,
    });
    sendSuccess(res, product, 'Inventory stock updated successfully');
  } catch (err) {
    next(err);
  }
};

export const getInventoryMovements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pagination = getPaginationParams(req.query as Record<string, unknown>);
    const productId = req.query.productId as string | undefined;
    const type = req.query.type as string | undefined;
    const result = await inventoryService.getMovements({ ...pagination, productId, type });
    sendPaginated(res, result, 'Inventory movements fetched successfully');
  } catch (err) {
    next(err);
  }
};

export const createInventoryMovement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const movement = await inventoryService.createMovement({
      productId: req.body.product_id,
      type: req.body.type,
      quantity: Number(req.body.quantity),
      reason: req.body.reason,
      userId: req.user!.userId,
    });
    sendCreated(res, movement, 'Inventory movement created successfully');
  } catch (err) {
    next(err);
  }
};
