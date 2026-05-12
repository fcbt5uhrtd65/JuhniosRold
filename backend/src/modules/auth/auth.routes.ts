import { Router } from 'express';
import { register, login, refreshToken, me, logout } from './auth.controller';
import { registerDto } from './dto/register.dto';
import { loginDto, refreshTokenDto } from './dto/login.dto';
import { validate } from '../../shared/middleware/validate.middleware';
import { authenticate } from '../../shared/middleware/auth.middleware';

// ============================================================
// Auth Routes — /api/auth
// ============================================================

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', registerDto, validate, register);

/**
 * @route   POST /api/auth/login
 * @desc    Login and receive JWT tokens
 * @access  Public
 */
router.post('/login', loginDto, validate, login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', refreshTokenDto, validate, refreshToken);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get('/me', authenticate, me);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout (client-side token discard)
 * @access  Private
 */
router.post('/logout', authenticate, logout);

export default router;
