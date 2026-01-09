import type { ExtractedData } from '../content/data-extractor'

export const indeedExtractor = {
    extract(): ExtractedData {
        // Indeed iframe or direct page
        const title = document.querySelector('.jobsearch-JobInfoHeader-title')?.textContent?.trim() || null

        const company = document.querySelector('[data-testid="inlineHeader-companyName"]')?.textContent?.trim() ||
            document.querySelector('.jobsearch-CompanyInfoContainer a')?.textContent?.trim() || null

        const location = document.querySelector('[data-testid="inlineHeader-companyLocation"]')?.textContent?.trim() || null

        const description = document.querySelector('#jobDescriptionText')?.innerHTML || null

        const url = window.location.href

        return {
            title,
            company,
            location,
            description,
            url,
            salary: document.querySelector('#salaryInfoAndJobType')?.textContent?.trim() || null,
            employmentType: null,
            deadline: null,
            requirements: null,
            benefits: null,
            platform: 'indeed',
            confidence: title && company ? 0.9 : 0.5
        }
    }
}
