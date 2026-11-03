import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const posts = await getAllPosts()
    return [
        { url: 'https://blog.applyos.io', changeFrequency: 'weekly', priority: 1 },
        ...posts.map((post) => ({
            url: `https://blog.applyos.io/${post.slug}`,
            lastModified: post.date,
        })),
    ]
}
