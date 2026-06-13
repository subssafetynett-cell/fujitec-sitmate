import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '')
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:4000'
  let basePath = env.VITE_BASE_PATH || '/'
  if (basePath !== '/') {
    if (!basePath.startsWith('/')) basePath = `/${basePath}`
    if (!basePath.endsWith('/')) basePath = `${basePath}/`
  }

  return {
    base: basePath,
    plugins: [react()],
    envDir: repoRoot,
    build: {
      chunkSizeWarningLimit: 3000,
    },
    server: {
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true },
        '/uploads': { target: proxyTarget, changeOrigin: true },
      },
    },
  }
})
