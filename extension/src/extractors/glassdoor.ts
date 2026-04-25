import type { ExtractedData } from '../content/data-extractor'

export const glassdoorExtractor = {
    extract(): ExtractedData {
        const title = document.querySelector('[data-test="job-title"]')?.textContent?.trim() || null

        const company = document.querySelector('[data-test="employer-name"]')?.textContent?.split(/\d/)[0].trim() || null

        const location = document.querySelector('[data-test="location"]')?.textContent?.trim() || null

        const description = (document.querySelector('.jobDescriptionContent') as HTMLElement)?.innerText?.trim() || null

        return {
            title,
            company,
            location,
            description,
            url: window.location.href,
            salary: document.querySelector('[data-test="salary-info"]')?.textContent?.trim() || null,
            employmentType: null,
            deadline: null,
            requirements: null,
            benefits: null,
            platform: 'glassdoor',
            confidence: title && company ? 0.9 : 0.5
        }
    }
}
