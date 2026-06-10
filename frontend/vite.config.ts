import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const devServerPort = Number(process.env.VITE_DEV_SERVER_PORT ?? '5173')
const hmrClientPort = Number(process.env.VITE_HMR_PORT ?? '5174')
const hmrHost = process.env.VITE_HMR_HOST ?? 'localhost'
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000'

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

function backendProxy(target: string) {
  return {
    target,
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
            })
          }
          res.end(
            JSON.stringify({ success: false, message: 'Backend unavailable — demo mode active' }),
          )
        } catch {
          // Socket already closed, ignore
        }
      })
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
  server: {
    host: '0.0.0.0',
    port: devServerPort,
    strictPort: true,
    proxy: {
      '/api': backendProxy(proxyTarget),
      '/health': backendProxy(proxyTarget),
    },
    hmr: {
      host: hmrHost,
      clientPort: hmrClientPort,
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
