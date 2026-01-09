import { linkedinExtractor } from '../extractors/linkedin'
import { indeedExtractor } from '../extractors/indeed'
import { workdayExtractor } from '../extractors/workday'
import { greenhouseExtractor } from '../extractors/greenhouse'
import { leverExtractor } from '../extractors/lever'
import { glassdoorExtractor } from '../extractors/glassdoor'
import { aiExtractor } from '../extractors/ai-fallback'
import type { PageDetectionResult } from './page-detector'

export interface ExtractedData {
    title: string | null
    company: string | null
    location: string | null
    description: string | null
    url: string
    salary: string | null
    employmentType: string | null
    deadline: string | null
    requirements: string[] | null
    benefits: string[] | null
    platform: string
    confidence: number
}

export interface IExtractor {
    extract(): ExtractedData | Promise<ExtractedData>
}

export class DataExtractor {
    static async extract(detection: PageDetectionResult): Promise<ExtractedData | null> {
        try {
            let data: ExtractedData | null = null

            console.log(`Extracting data for platform: ${detection.platform}`)

            switch (detection.platform) {
                case 'linkedin':
                    data = linkedinExtractor.extract()
                    break
                case 'indeed':
                    data = indeedExtractor.extract()
                    break
                case 'workday':
                    data = workdayExtractor.extract()
                    break
                case 'greenhouse':
                    data = greenhouseExtractor.extract()
                    break
                case 'lever':
                    data = leverExtractor.extract()
                    break
                case 'glassdoor':
                    data = glassdoorExtractor.extract()
                    break
                default:
                    console.log('Using AI fallback extractor')
                    data = await aiExtractor.extract()
            }

            return data
        } catch (error) {
            console.error('Extraction error:', error)
            try {
                return await aiExtractor.extract()
            } catch (fallbackError) {
                return null
            }
        }
    }
}
