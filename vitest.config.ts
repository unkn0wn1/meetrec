import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('electron/shared')
    }
  },
  test: {
    environment: 'node',
    include: ['electron/**/*.test.ts', 'src/**/*.test.ts']
  }
})
