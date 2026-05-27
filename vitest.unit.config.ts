import { defineConfig } from 'vitest/config'
import path from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.unit.ts'],
    include: [
      'tests/unit/**/*.{test,spec}.{ts,tsx}',
      'shared/**/*.{test,spec}.{ts,tsx}',
      'modules/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      'node_modules',
      '.next',
      'dist',
      'tests/integration',
      'tests/e2e',
      'shared/infrastructure/ai/__tests__/model-manager.test.ts',
    ],
    coverage: {
      reporter: ['text', 'text-summary', 'json', 'html'],
      exclude: ['node_modules', '.next', 'dist', 'tests/**', '**/*.config.*', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
