import type { ExtractedData } from '../content/data-extractor'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini (needs API key from storage or env)
// For now we'll assume the key is passed or retrieved from storage
const initAI = async () => {
    // This would typically read from extension storage where user has enhanced settings
    // or use a proxied backend endpoint.
    // For client-side only (not recommended for production without proxy), we'd need the key.
    return null;
}

export const aiExtractor = {
    async extract(): Promise<ExtractedData> {
        // Fallback: Use basic heuristic extraction
        // In a full implementation, this would send page text to Gemini API

        const title = document.querySelector('h1')?.textContent?.trim() || document.title
        const company = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || null
        const description = document.querySelector('main')?.innerHTML || document.body.innerText.substring(0, 2000)

        return {
            title,
            company,
            location: null,
            description,
            url: window.location.href,
            salary: null,
            employmentType: null,
            deadline: null,
            requirements: null,
            benefits: null,
            platform: 'unknown-ai-fallback',
            confidence: 0.4
        }
    }
}
