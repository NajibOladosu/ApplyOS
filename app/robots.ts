import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/dashboard/', '/applications/', '/documents/', '/interview/', '/notifications/', '/feedback/', '/profile/', '/settings/', '/upload/'],
        },
        sitemap: 'https://www.applyos.io/sitemap.xml',
    }
}
