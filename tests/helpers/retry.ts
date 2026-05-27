export async function retry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number; shouldRetry?: (err: unknown) => boolean } = {}
): Promise<T> {
  const retries = opts.retries ?? 3
  const baseMs = opts.baseMs ?? 1000
  const shouldRetry = opts.shouldRetry ?? ((err) => {
    const msg = String((err as Error)?.message ?? err)
    return /429|503|rate limit|UNAVAILABLE|fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg)
  })

  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt === retries || !shouldRetry(err)) throw err
      const wait = baseMs * Math.pow(2, attempt)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw lastErr
}
