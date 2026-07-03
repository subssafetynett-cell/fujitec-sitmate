import path from 'node:path'
import { fileURLToPath } from 'node:url'
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
    resolve: {
      dedupe: ["react", "react-dom", "react/jsx-runtime"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "recharts"],
    },
    build: {
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          // Only split heavy PDF/export libs. Recharts/MUI must stay with React's module
          // graph — a separate "charts" chunk causes "Cannot set properties of undefined
          // (setting 'Children')" in production when chunks load in the wrong order.
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (
              id.includes("html2canvas") ||
              id.includes("jspdf") ||
              id.includes("docx") ||
              id.includes("file-saver")
            ) {
              return "export";
            }
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true },
        '/uploads': { target: proxyTarget, changeOrigin: true },
      },
    },
  }
})
