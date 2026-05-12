import { JwtPayload } from './index';

// ============================================================
// Express Request Augmentation — Juhnios Rold Backend
// ============================================================

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
