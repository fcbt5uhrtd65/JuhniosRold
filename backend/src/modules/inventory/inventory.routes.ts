import { Router } from 'express';
import {
  createInventoryMovement,
  getInventory,
  getInventoryMovements,
  getLowStock,
  updateInventoryStock,
} from './inventory.controller';
import { createInventoryMovementDto, updateInventoryStockDto } from './dto/inventory.dto';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { staffOnly } from '../../shared/middleware/roles.middleware';
import { validate } from '../../shared/middleware/validate.middleware';

const router = Router();

router.use(authenticate, staffOnly);

router.get('/', getInventory);
router.get('/low-stock', getLowStock);
router.patch('/:productId/stock', updateInventoryStockDto, validate, updateInventoryStock);
router.get('/movements', getInventoryMovements);
router.post('/movements', createInventoryMovementDto, validate, createInventoryMovement);

export default router;
