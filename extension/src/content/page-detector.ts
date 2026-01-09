export interface PageDetectionResult {
    isApplicationPage: boolean
    platform: 'linkedin' | 'indeed' | 'workday' | 'greenhouse' | 'lever' | 'glassdoor' | 'unknown'
    confidence: number
    metadata: {
        detectionMethod: 'url' | 'structured-data' | 'heuristic'
        signals: string[]
    }
}

export class PageDetector {
    static detect(): PageDetectionResult {
        // Layer 1: URL matching (fastest, most accurate)
        const urlResult = this.detectByURL()
        if (urlResult.confidence > 0.9) return urlResult

        // Layer 2: Structured data (JSON-LD)
        const structuredResult = this.detectByStructuredData()
        if (structuredResult && structuredResult.confidence > 0.85) return structuredResult

        // Layer 3: Heuristics (DOM analysis)
        const heuristicResult = this.detectByHeuristics()
        if (heuristicResult && heuristicResult.confidence > 0.7) return heuristicResult

        // Not detected
        return {
            isApplicationPage: false,
            platform: 'unknown',
            confidence: 0,
            metadata: { detectionMethod: 'url', signals: [] }
        }
    }

    private static detectByURL(): PageDetectionResult {
        const url = window.location.href
        const hostname = window.location.hostname

        // LinkedIn
        if (hostname.includes('linkedin.com') && url.includes('/jobs/')) {
            return {
                isApplicationPage: true,
                platform: 'linkedin',
                confidence: 0.95,
                metadata: { detectionMethod: 'url', signals: ['linkedin-jobs-url'] }
            }
        }

        // Indeed
        if (hostname.includes('indeed.com') && (url.includes('/viewjob') || url.includes('/rc/clk'))) {
            return {
                isApplicationPage: true,
                platform: 'indeed',
                confidence: 0.95,
                metadata: { detectionMethod: 'url', signals: ['indeed-viewjob-url'] }
            }
        }

        // Workday
        if (hostname.includes('myworkdayjobs.com')) {
            return {
                isApplicationPage: true,
                platform: 'workday',
                confidence: 0.95,
                metadata: { detectionMethod: 'url', signals: ['workday-url'] }
            }
        }

        // Greenhouse
        if (hostname.includes('greenhouse.io') && (url.includes('/jobs/') || document.querySelector('div#app_body'))) {
            return {
                isApplicationPage: true,
                platform: 'greenhouse',
                confidence: 0.95,
                metadata: { detectionMethod: 'url', signals: ['greenhouse-url'] }
            }
        }

        // Lever
        if (hostname.includes('lever.co')) {
            return {
                isApplicationPage: true,
                platform: 'lever',
                confidence: 0.95,
                metadata: { detectionMethod: 'url', signals: ['lever-url'] }
            }
        }

        // Glassdoor
        if (hostname.includes('glassdoor.com') && url.includes('/job-listing/')) {
            return {
                isApplicationPage: true,
                platform: 'glassdoor',
                confidence: 0.95,
                metadata: { detectionMethod: 'url', signals: ['glassdoor-url'] }
            }
        }

        return {
            isApplicationPage: false,
            platform: 'unknown',
            confidence: 0,
            metadata: { detectionMethod: 'url', signals: [] }
        }
    }

    private static detectByStructuredData(): PageDetectionResult | null {
        // Check for JSON-LD JobPosting schema
        const scripts = document.querySelectorAll('script[type="application/ld+json"]')

        for (const script of scripts) {
            try {
                const data = JSON.parse(script.textContent || '')

                if (data['@type'] === 'JobPosting' ||
                    (Array.isArray(data['@graph']) &&
                        data['@graph'].some((item: any) => item['@type'] === 'JobPosting'))) {
                    return {
                        isApplicationPage: true,
                        platform: 'unknown', // Can't determine platform just from schema usually
                        confidence: 0.90,
                        metadata: {
                            detectionMethod: 'structured-data',
                            signals: ['schema-org-jobposting']
                        }
                    }
                }
            } catch (e) {
                // Invalid JSON, skip
            }
        }

        return null
    }

    private static detectByHeuristics(): PageDetectionResult | null {
        const signals: string[] = []
        let score = 0

        // Check title
        const title = document.title.toLowerCase()
        if (title.includes('job') || title.includes('career') || title.includes('position') || title.includes('hiring')) {
            score += 20
            signals.push('title-match')
        }

        // Check for apply button
        const buttons = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"]'))
            .map(b => b.textContent?.toLowerCase() || (b as HTMLInputElement).value?.toLowerCase() || '')

        if (buttons.some(text => text.includes('apply') || text.includes('submit application'))) {
            score += 30
            signals.push('apply-button-found')
        }

        // Check for common headings
        const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
            .map(h => h.textContent?.toLowerCase() || '')
            .join(' ')

        if (headings.includes('job description') || headings.includes('qualifications') || headings.includes('requirements')) {
            score += 25
            signals.push('heading-match')
        }

        if (score >= 50) {
            return {
                isApplicationPage: true,
                platform: 'unknown',
                confidence: Math.min(score / 100, 0.8),
                metadata: { detectionMethod: 'heuristic', signals }
            }
        }

        return null
    }
}
