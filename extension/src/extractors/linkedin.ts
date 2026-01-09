import type { ExtractedData } from '../content/data-extractor'

export const linkedinExtractor = {
    extract(): ExtractedData {
        // LinkedIn has different layouts, we need to handle them
        // 1. /jobs/view/ layout
        // 2. /jobs/collections/ layout
        // 3. Easy Apply modal (future)

        // Selectors for standard Job View
        const title = document.querySelector('.job-details-jobs-unified-top-card__job-title')?.textContent?.trim() ||
            document.querySelector('h1')?.textContent?.trim() || null

        const company = document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent?.trim() ||
            document.querySelector('.jobs-unified-top-card__company-name')?.textContent?.trim() || null

        const location = document.querySelector('.job-details-jobs-unified-top-card__bullet')?.textContent?.trim() ||
            document.querySelector('.jobs-unified-top-card__bullet')?.textContent?.trim() || null

        let description = document.querySelector('.jobs-description__content')?.innerHTML ||
            document.querySelector('#job-details')?.innerHTML || null

        // Clean description HTML slightly if needed (remove comments etc)
        if (description) {
            description = description.replace(/<!---->/g, '')
        }

        const salary = document.querySelector('.salary-main-rail__salary-info')?.textContent?.trim() || null

        // Employment type usually inside one of the insight items
        const insightItems = Array.from(document.querySelectorAll('.job-details-jobs-unified-top-card__job-insight span'))
        let employmentType = null
        for (const item of insightItems) {
            const text = item.textContent?.toLowerCase() || ''
            if (text.includes('full-time') || text.includes('part-time') || text.includes('contract') || text.includes('temporary')) {
                employmentType = item.textContent?.trim() || null
                break
            }
        }

        return {
            title,
            company,
            location,
            description, // Keeping HTML for rich text preservation
            url: window.location.href,
            salary,
            employmentType,
            deadline: null,
            requirements: null, // Hard to extract without NLP
            benefits: null,
            platform: 'linkedin',
            confidence: title && company ? 0.9 : 0.5
        }
    }
}
