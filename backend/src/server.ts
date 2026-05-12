import app from './app';
import { env } from './config/env';
import { testConnection } from './config/database';

// ============================================================
// Server Entry Point — Juhnios Rold Backend
// ============================================================

const startServer = async (): Promise<void> => {
  try {
    // Test database connection before starting
    await testConnection();

    const server = app.listen(env.PORT, () => {
      console.log('');
      console.log('╔════════════════════════════════════════════╗');
      console.log('║    🌿 JUHNIOS ROLD BACKEND SERVER          ║');
      console.log('╠════════════════════════════════════════════╣');
      console.log(`║  Environment : ${env.NODE_ENV.padEnd(27)}║`);
      console.log(`║  Port        : ${String(env.PORT).padEnd(27)}║`);
      console.log(`║  API Prefix  : ${env.API_PREFIX.padEnd(27)}║`);
      console.log('╚════════════════════════════════════════════╝');
      console.log('');
      console.log(`  🔐 Auth    → http://localhost:${env.PORT}${env.API_PREFIX}/auth`);
      console.log(`  👤 Users   → http://localhost:${env.PORT}${env.API_PREFIX}/users`);
      console.log(`  📦 Products→ http://localhost:${env.PORT}${env.API_PREFIX}/products`);
      console.log(`  🛒 Orders  → http://localhost:${env.PORT}${env.API_PREFIX}/orders`);
      console.log(`  ⭐ PRO     → http://localhost:${env.PORT}${env.API_PREFIX}/pro`);
      console.log(`  ❤️  Health  → http://localhost:${env.PORT}/health`);
      console.log('');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('[Server] SIGTERM received — shutting down gracefully...');
      server.close(() => {
        console.log('[Server] Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('[Server] SIGINT received — shutting down gracefully...');
      server.close(() => {
        console.log('[Server] Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
};

startServer();
