import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import tsconfigPathsPlugin from 'vite-tsconfig-paths'
import { resolve } from 'node:path'

const tsconfigPaths = tsconfigPathsPlugin({
  projects: [resolve('tsconfig.json')],
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')

  if (!env.CLIENT_PORT) {
    throw new Error('CLIENT_PORT environment variable is required')
  }

  if (!env.SERVER_PORT) {
    throw new Error('SERVER_PORT environment variable is required')
  }

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
      proxy: {
        '/api': {
          target: `http://localhost:${env.SERVER_PORT}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
