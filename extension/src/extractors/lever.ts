import type { ExtractedData } from '../content/data-extractor'

export const leverExtractor = {
    extract(): ExtractedData {
        const title = document.querySelector('.posting-headline h2')?.textContent?.trim() || null

        const company = document.title.split('-')[0].trim() || null

        const location = document.querySelector('.posting-categories .location')?.textContent?.trim() || null

        const description = (document.querySelector('.posting-description') as HTMLElement)?.innerText?.trim() || null

        const employmentType = document.querySelector('.posting-categories .commitment')?.textContent?.trim() || null

        return {
            title,
            company,
            location,
            description,
            url: window.location.href,
            salary: null,
            employmentType,
            deadline: null,
            requirements: null,
            benefits: null,
            platform: 'lever',
            confidence: title ? 0.9 : 0.5
        }
    }
}
