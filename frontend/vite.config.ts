import { defineConfig, type Plugin, type ProxyOptions } from 'vite'
import path from 'node:path'
import type { ServerResponse } from 'node:http'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const devServerPort = Number(process.env.VITE_DEV_SERVER_PORT ?? '5173')
const hmrClientPort = Number(process.env.VITE_HMR_PORT ?? '5174')
const hmrHost = process.env.VITE_HMR_HOST ?? 'localhost'
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000'

function figmaAssetResolver(): Plugin {
  return {
    name: 'figma-asset-resolver',

    resolveId(id: string): string | undefined {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }

      return undefined
    },
  }
}

function isServerResponse(value: unknown): value is ServerResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'writeHead' in value &&
    typeof (value as ServerResponse).writeHead === 'function'
  )
}

function hasEndMethod(value: unknown): value is { end: (data?: string) => void } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'end' in value &&
    typeof (value as { end?: unknown }).end === 'function'
  )
}

function backendProxy(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    secure: false,

    configure(proxy): void {
      proxy.on('error', (_err, _req, res) => {
        // Backend not running — return a JSON 503 so the frontend
        // falls back to demo/localStorage mode silently.
        try {
          if (isServerResponse(res)) {
            res.writeHead(503, {
              'Content-Type': 'application/json',
            })
          }

          if (hasEndMethod(res)) {
            res.end(
              JSON.stringify({
                success: false,
                message: 'Backend unavailable — demo mode active',
              }),
            )
          }
        } catch {
          // Socket already closed, ignore
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [figmaAssetResolver(), react(), tailwindcss()],

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
      '/media': backendProxy(proxyTarget),
    },

    hmr: {
      host: hmrHost,
      clientPort: hmrClientPort,
    },
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],
})
