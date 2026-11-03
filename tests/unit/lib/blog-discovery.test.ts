import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/blog', () => ({
    getAllPosts: vi.fn().mockResolvedValue([
        { slug: 'saved-resume', date: '2026-11-03' },
        { slug: 'earlier-post', date: '2026-10-01' },
    ]),
}))

import sitemap from '@/app/blog/sitemap'
import { GET as robots } from '@/app/blog/robots.txt/route'

describe('blog discovery on the blog subdomain', () => {
    it('lists the blog home and every article using public canonical URLs', async () => {
        const entries = await sitemap()
        expect(entries.map((entry) => entry.url)).toEqual([
            'https://blog.applyos.io',
            'https://blog.applyos.io/saved-resume',
            'https://blog.applyos.io/earlier-post',
        ])
        expect(entries[1].lastModified).toBe('2026-11-03')
    })

    it('advertises the blog sitemap as plain-text crawler instructions', async () => {
        const response = robots()
        expect(response.headers.get('Content-Type')).toContain('text/plain')
        expect(await response.text()).toBe('User-agent: *\nAllow: /\n\nSitemap: https://blog.applyos.io/sitemap.xml\n')
    })
})
