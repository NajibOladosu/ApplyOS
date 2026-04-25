import type { ExtractedData } from '../content/data-extractor'

export const aiExtractor = {
    async extract(): Promise<ExtractedData> {
        // Heuristic-based fallback extraction for unsupported platforms.
        // Uses generic DOM selectors to extract job details when no
        // platform-specific extractor matches.

        const title = document.querySelector('h1')?.textContent?.trim() || document.title
        const company = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || null
        const description = (document.querySelector('main') as HTMLElement)?.innerText?.trim()
            || document.body.innerText.substring(0, 2000)

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
            platform: 'unknown-fallback',
            confidence: 0.4
        }
    }
}
