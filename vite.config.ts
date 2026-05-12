import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Proxy API calls to local backend in development.
  // Error handler prevents "send was called before connect" when backend is offline.
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            // Backend not running — return a JSON 503 so the frontend
            // falls back to demo/localStorage mode silently.
            try {
              // res can be either http.ServerResponse or a net.Socket
              if (typeof (res as { writeHead?: unknown }).writeHead === 'function') {
                (res as import('http').ServerResponse).writeHead(503, {
                  'Content-Type': 'application/json',
                });
              }
              res.end(
                JSON.stringify({ success: false, message: 'Backend unavailable — demo mode active' }),
              );
            } catch {
              // Socket already closed, ignore
            }
          });
        },
      },
    },
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],
})