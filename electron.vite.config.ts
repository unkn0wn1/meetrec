import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite'

const OAUTH_ENV_KEYS = [
  'MEETREC_GOOGLE_CLIENT_ID',
  'MEETREC_GOOGLE_CLIENT_SECRET',
  'MEETREC_MICROSOFT_CLIENT_ID'
] as const

function oauthDefines(mode: string): Record<string, string> {
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const defines: Record<string, string> = {}
  for (const key of OAUTH_ENV_KEYS) {
    const value = process.env[key] ?? fileEnv[key] ?? ''
    defines[`process.env.${key}`] = JSON.stringify(value)
  }
  return defines
}

export default defineConfig(({ mode }) => {
  const defines = oauthDefines(mode)
  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      define: defines,
      build: {
        rollupOptions: {
          input: {
            index: resolve('electron/main/index.ts')
          }
        }
      }
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          input: {
            index: resolve('electron/preload/index.ts')
          }
        }
      }
    },
    renderer: {
      root: resolve('src'),
      resolve: {
        alias: {
          '@': resolve('src'),
          '@shared': resolve('electron/shared')
        }
      },
      plugins: [vue(), tailwindcss()],
      build: {
        rollupOptions: {
          input: {
            index: resolve('src/index.html')
          }
        }
      }
    }
  }
})
