import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import tsconfigPathsPlugin from 'vite-tsconfig-paths'
import { resolve } from 'node:path'

const tsconfigPaths = tsconfigPathsPlugin({
  projects: [resolve('tsconfig.json')],
})

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')

  if (!env.CLIENT_PORT) {
    throw new Error('CLIENT_PORT environment variable is required')
  }

  // SERVER_PORT only needed for dev server proxy
  if (command === 'serve' && !env.SERVER_PORT) {
    throw new Error('SERVER_PORT environment variable is required')
  }

  // Use Docker internal hostname in production, localhost in dev
  const isProduction = env.NODE_ENV === 'production'
  const backendTarget = isProduction
    ? 'http://backend:3000'
    : `http://localhost:${env.SERVER_PORT}`

  return {
    css: {
      preprocessorMaxWorkers: true,
    },
    root: path.resolve(__dirname),
    envDir: path.resolve(__dirname, '..'),
    plugins: [tsconfigPaths, react()],
    publicDir: resolve(__dirname, 'public'),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: Number(env.CLIENT_PORT),
      allowedHosts: ['adi-client.the-ihor.com'],
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    preview: {
      allowedHosts: ['adi-client.the-ihor.com'],
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
