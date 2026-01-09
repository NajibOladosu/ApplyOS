import type { ExtractedData } from '../content/data-extractor'

export const workdayExtractor = {
    extract(): ExtractedData {
        // Workday is tricky because of dynamic IDs, rely on data-automation-id if possible

        const title = document.querySelector('[data-automation-id="jobPostingHeader"]')?.textContent?.trim() || null

        const company = document.title.split('-')[0].trim() || null // Usually in title

        const location = document.querySelector('[data-automation-id="jobPostingHeader"] + div')?.textContent?.trim() || null

        const description = document.querySelector('[data-automation-id="jobPostingDescription"]')?.innerHTML || null

        return {
            title,
            company,
            location,
            description,
            url: window.location.href,
            salary: null,
            employmentType: document.querySelector('[data-automation-id="jobPostingTimeType"]')?.textContent?.trim() || null,
            deadline: null,
            requirements: null,
            benefits: null,
            platform: 'workday',
            confidence: title ? 0.8 : 0.4
        }
    }
}
