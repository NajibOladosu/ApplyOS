import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['**/*.{test,spec}.{ts,tsx}'],
        exclude: ['node_modules', '.next', 'dist'],
        coverage: {
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules', '.next', 'dist'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
})
