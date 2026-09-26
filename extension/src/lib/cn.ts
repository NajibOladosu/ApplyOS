import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Conditional class names with Tailwind conflict resolution.
 * Same contract as shared/lib/utils.ts in the web app, so class strings can be
 * copy-pasted between the two without surprise.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
