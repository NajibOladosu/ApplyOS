import type { ExtractedData } from '../content/data-extractor'

export const greenhouseExtractor = {
    extract(): ExtractedData {
        // Greenhouse boards usually look very similar

        const title = document.querySelector('.app-title')?.textContent?.trim() ||
            document.querySelector('h1.app-title')?.textContent?.trim() || null

        const company = document.querySelector('.company-name')?.textContent?.trim()?.replace('at ', '') || null

        const location = document.querySelector('.location')?.textContent?.trim() || null

        const description = document.querySelector('#content')?.innerHTML || null

        return {
            title,
            company,
            location,
            description,
            url: window.location.href,
            salary: null,
            employmentType: null,
            deadline: null,
            requirements: null,
            benefits: null,
            platform: 'greenhouse',
            confidence: title ? 0.9 : 0.5
        }
    }
}
