/**
 * Password Security Utilities
 *
 * Client-side password breach checking using HaveIBeenPwned API
 * and password strength validation.
 *
 * This is a free alternative to Supabase Pro's built-in leaked password protection.
 */

/**
 * Check if a password has been exposed in known data breaches
 * Uses HaveIBeenPwned API with k-anonymity model (privacy-preserving)
 *
 * @param password - The password to check
 * @returns true if password has been breached, false if safe
 */
export async function checkPasswordBreached(password: string): Promise<boolean> {
  try {
    // Hash password with SHA-1 (HaveIBeenPwned uses SHA-1)
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-1', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()

    // Send first 5 characters to HaveIBeenPwned API (k-anonymity model)
    // This preserves privacy - full hash never leaves the browser
    const prefix = hashHex.substring(0, 5)
    const suffix = hashHex.substring(5)

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Trackly-Password-Check',
      },
    })

    if (!response.ok) {
      console.error('HaveIBeenPwned API error:', response.status)
      // Fail open: allow password if API is down
      return false
    }

    const text = await response.text()

    // Check if our hash suffix is in the results
    // Each line is: SUFFIX:COUNT
    const lines = text.split('\n')
    for (const line of lines) {
      const [hashSuffix] = line.split(':')
      if (hashSuffix === suffix) {
        return true // Password found in breach database
      }
    }

    return false // Password is safe
  } catch (error) {
    console.error('Password breach check failed:', error)
    // Fail open: allow password if check fails
    // Better to allow weak password than block legitimate signups
    return false
  }
}

/**
 * Validate password strength with comprehensive rules
 *
 * @param password - The password to validate
 * @returns Validation result with message if invalid
 */
export function validatePasswordStrength(password: string): {
  valid: boolean
  message?: string
} {
  // Minimum length
  if (password.length < 12) {
    return {
      valid: false,
      message: 'Password must be at least 12 characters long',
    }
  }

  // Maximum length (prevent DoS)
  if (password.length > 128) {
    return {
      valid: false,
      message: 'Password must be less than 128 characters',
    }
  }

  // Must contain uppercase letter
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one uppercase letter',
    }
  }

  // Must contain lowercase letter
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one lowercase letter',
    }
  }

  // Must contain number
  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one number',
    }
  }

  // Must contain special character
  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one special character (!@#$%^&*)',
    }
  }

  // Reject common patterns
  const commonPatterns = [
    { pattern: /^(.)\1+$/, message: 'Password cannot be all the same character' },
    {
      pattern: /^(012|123|234|345|456|567|678|789|890)+/,
      message: 'Password contains sequential numbers',
    },
    {
      pattern:
        /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+/i,
      message: 'Password contains sequential letters',
    },
    {
      pattern: /^(qwert|asdf|zxcv)/i,
      message: 'Password contains keyboard patterns',
    },
  ]

  for (const { pattern, message } of commonPatterns) {
    if (pattern.test(password)) {
      return { valid: false, message }
    }
  }

  return { valid: true }
}

/**
 * Comprehensive password validation
 * Checks both strength and breach status
 *
 * @param password - The password to validate
 * @returns Validation result with message if invalid
 */
export async function validatePassword(password: string): Promise<{
  valid: boolean
  message?: string
}> {
  // First check password strength (fast, no API call)
  const strengthResult = validatePasswordStrength(password)
  if (!strengthResult.valid) {
    return strengthResult
  }

  // Then check if password has been breached (API call)
  const isBreached = await checkPasswordBreached(password)
  if (isBreached) {
    return {
      valid: false,
      message:
        'This password has been exposed in data breaches. Please choose a different password.',
    }
  }

  return { valid: true }
}

/**
 * Get password strength indicator (0-4)
 * Useful for showing password strength meter to users
 *
 * @param password - The password to check
 * @returns Strength score (0 = very weak, 4 = very strong)
 */
export function getPasswordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong'
} {
  let score = 0

  // Length scoring
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (password.length >= 16) score++

  // Complexity scoring
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  // Pattern penalties
  if (/(.)\1{2,}/.test(password)) score-- // Repeated characters
  if (/^(012|123|234|345|456|567|678|789|890|abc|bcd|cde)+/i.test(password)) score-- // Sequential

  // Clamp score between 0 and 4
  const clampedScore = Math.max(0, Math.min(4, score)) as 0 | 1 | 2 | 3 | 4

  const labels: Record<0 | 1 | 2 | 3 | 4, 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong'> = {
    0: 'Very Weak',
    1: 'Weak',
    2: 'Fair',
    3: 'Strong',
    4: 'Very Strong',
  }

  return {
    score: clampedScore,
    label: labels[clampedScore],
  }
}
