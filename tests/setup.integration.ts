import { loadTestEnv } from './helpers/env'
import { vi } from 'vitest'

loadTestEnv()

// Mock server-only so server-side modules can import in node env
vi.mock('server-only', () => ({}))

process.env.TEST_RUN_ID = process.env.TEST_RUN_ID || `run_${Date.now()}`
