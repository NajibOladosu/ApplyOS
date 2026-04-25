import type { ExtractedData } from '../content/data-extractor'

export const linkedinExtractor = {
    extract(): ExtractedData {
        // LinkedIn DOM Selectors (Updated 2024/2026)

        // Strategy 1: Visible DOM Elements (Best for accuracy if valid)
        let title = findText([
            '.job-details-jobs-unified-top-card__job-title',
            '.jobs-unified-top-card__job-title',
            'h1.top-card-layout__title',
            'h1.t-24'
        ])

        let company = findText([
            '.job-details-jobs-unified-top-card__company-name',
            '.jobs-unified-top-card__company-name',
            '.top-card-layout__card .topbar__company-name',
            '.job-details-jobs-unified-top-card__company-name a',
            '.jobs-unified-top-card__subtitle-primary-grouping a'
        ])

        // Strategy 2: Meta Tags (Reliable backup)
        if (!title) {
            title = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || null
        }
        if (!company) {
            // LinkedIn doesn't always have og:site_name set to company, usually it's "LinkedIn"
            // But sometimes the title is "Job Title at Company"
            const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
            if (ogTitle && ogTitle.includes(' at ')) {
                // Heuristic: "Senior Engineer at Google"
                const parts = ogTitle.split(' at ')
                // If we split into 2 parts, part 0 is title, part 1 is company
                // But "at" can be in title. So be careful.
                if (parts.length > 1 && !title) title = parts[0].trim()
                if (parts.length > 1) {
                    // Take the last part as company usually
                    company = parts[parts.length - 1].trim()
                }
            }
        }

        // Strategy 3: Heuristic Page Title parsing (Last resort)
        // "Senior Frontend Engineer | Google | LinkedIn"
        if (!title || !company) {
            const pageTitle = document.title
            const parts = pageTitle.split('|')
            if (parts.length >= 2) {
                if (!title) title = parts[0].trim()
                if (!company) company = parts[1].trim()
            }
        }

        // Location
        const location = findText([
            '.job-details-jobs-unified-top-card__bullet',
            '.jobs-unified-top-card__bullet',
            '.job-details-jobs-unified-top-card__workplace-type',
            '.top-card-layout__first-subline .topcard__flavor--bullet'
        ])

        // Description - extraction and cleaning
        // User requested NO HTML/JS. So we use innerText and clean it.
        const descriptionSelectors = [
            '.jobs-description__content',
            '#job-details',
            '.description__text',
            '.jobs-box__html-content'
        ]
        let description = null
        for (const selector of descriptionSelectors) {
            const el = document.querySelector(selector) as HTMLElement
            if (el) {
                // Clone to not modify live page
                const clone = el.cloneNode(true) as HTMLElement
                // Remove hidden stuff, scripts, styles, buttons
                const trash = clone.querySelectorAll('script, style, .visually-hidden, button, .artdeco-button')
                trash.forEach(n => n.remove())

                // Get text
                description = clone.innerText
                break
            }
        }

        if (description) {
            // Basic cleanup
            description = description
                .replace(/<!---->/g, '')
                .replace(/\n\s*\n/g, '\n\n') // Normalize newlines
                .trim()
        }

        // Salary
        const salary = findText(['.salary-main-rail__salary-info'])

        // Employment Type
        let employmentType = null
        const insightItems = Array.from(document.querySelectorAll('.job-details-jobs-unified-top-card__job-insight span, .jobs-unified-top-card__job-insight span'))
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
            description,
            url: window.location.href,
            salary,
            employmentType,
            deadline: null,
            requirements: null,
            benefits: null,
            platform: 'linkedin',
            confidence: title && company ? 0.95 : 0.5
        }
    }
}

function findText(selectors: string[]): string | null {
    for (const selector of selectors) {
        const el = document.querySelector(selector)
        if (el && el.textContent && el.textContent.trim().length > 0) {
            return el.textContent.trim()
        }
    }
    return null
}

