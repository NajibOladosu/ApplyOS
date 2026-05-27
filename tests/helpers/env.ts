import { config } from 'dotenv'
import path from 'path'

let loaded = false
export function loadTestEnv() {
  if (loaded) return
  config({ path: path.join(process.cwd(), '.env.local') })
  config({ path: path.join(process.cwd(), '.env') })
  loaded = true

  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]
  const missing = required.filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(`Missing env vars for integration tests: ${missing.join(', ')}`)
  }
}
