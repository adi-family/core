import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import tsconfigPathsPlugin from 'vite-tsconfig-paths'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'

const tsconfigPaths = tsconfigPathsPlugin({
  projects: [resolve('tsconfig.json')],
})

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, '../..')
  const env = loadEnv(mode, envDir, '')

  if (!env.CLIENT_PORT) {
    throw new Error('CLIENT_PORT environment variable is required')
  }

  if (!env.BACKEND_URL) {
    throw new Error('BACKEND_URL environment variable is required')
  }

  return {
    css: {
      preprocessorMaxWorkers: true,
    },
    root: path.resolve(__dirname),
    envDir: path.resolve(__dirname, '../..'),
    plugins: [tsconfigPaths, react(), tailwindcss()],
    publicDir: resolve(__dirname, 'public'),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: Number(env.CLIENT_PORT),
      allowedHosts: ['adi-app.the-ihor.com'],
      proxy: {
        '/api': {
          target: env.BACKEND_URL,
          changeOrigin: true,
          // Don't rewrite - backend expects /api prefix
        },
      },
    },
    preview: {
      allowedHosts: ['adi-app.the-ihor.com'],
      proxy: {
        '/api': {
          target: env.BACKEND_URL,
          changeOrigin: true,
          // Don't rewrite - backend expects /api prefix
        },
      },
    },
  }
})
