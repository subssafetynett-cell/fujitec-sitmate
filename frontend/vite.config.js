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
      dedupe: ["react", "react-dom"],
    },
    build: {
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;

            const isReactCore =
              /node_modules[\\/]react[\\/]/.test(id) ||
              /node_modules[\\/]react-dom[\\/]/.test(id) ||
              /node_modules[\\/]react-router/.test(id) ||
              /node_modules[\\/]scheduler[\\/]/.test(id);

            if (isReactCore) return "vendor";

            if (id.includes("recharts") || id.includes("victory-vendor") || /[\\/]d3-/.test(id)) {
              return "charts";
            }
            if (id.includes("@mui") || id.includes("@emotion")) return "mui";
            if (id.includes("html2canvas") || id.includes("jspdf") || id.includes("docx")) {
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
