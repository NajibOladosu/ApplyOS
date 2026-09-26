import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

// Blog post metadata interface
export interface BlogPost {
    slug: string
    title: string
    excerpt: string
    date: string
    coverImage: string
    author: {
        name: string
        avatar?: string
    }
    tags?: string[]
    content: string
}

// Type for the frontmatter
export interface BlogPostFrontmatter {
    title: string
    excerpt: string
    date: string
    coverImage: string
    author: {
        name: string
        avatar?: string
    }
    tags?: string[]
}

// Directory where blog posts are stored
const BLOG_CONTENT_DIR = path.join(process.cwd(), 'content', 'blog')

/**
 * Get all blog posts sorted by date (newest first)
 */
export async function getAllPosts(): Promise<BlogPost[]> {
    // Ensure the content directory exists
    if (!fs.existsSync(BLOG_CONTENT_DIR)) {
        return []
    }

    const files = fs.readdirSync(BLOG_CONTENT_DIR)
    const mdxFiles = files.filter((file) => file.endsWith('.mdx'))

    const posts = mdxFiles.map((filename) => {
        const slug = filename.replace('.mdx', '')
        const filePath = path.join(BLOG_CONTENT_DIR, filename)
        const fileContents = fs.readFileSync(filePath, 'utf8')
        const { data, content } = matter(fileContents)
        const frontmatter = data as BlogPostFrontmatter

        return {
            slug,
            title: frontmatter.title,
            excerpt: frontmatter.excerpt,
            date: frontmatter.date,
            coverImage: frontmatter.coverImage,
            author: frontmatter.author,
            tags: frontmatter.tags,
            content,
        }
    })

    // Sort by date (newest first)
    return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

/**
 * Get a single blog post by slug
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
    const filePath = path.join(BLOG_CONTENT_DIR, `${slug}.mdx`)

    if (!fs.existsSync(filePath)) {
        return null
    }

    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(fileContents)
    const frontmatter = data as BlogPostFrontmatter

    return {
        slug,
        title: frontmatter.title,
        excerpt: frontmatter.excerpt,
        date: frontmatter.date,
        coverImage: frontmatter.coverImage,
        author: frontmatter.author,
        tags: frontmatter.tags,
        content,
    }
}

/**
 * Get all post slugs for static generation
 */
export async function getAllPostSlugs(): Promise<string[]> {
    if (!fs.existsSync(BLOG_CONTENT_DIR)) {
        return []
    }

    const files = fs.readdirSync(BLOG_CONTENT_DIR)
    return files
        .filter((file) => file.endsWith('.mdx'))
        .map((file) => file.replace('.mdx', ''))
}

/**
 * Format date for display
 */
/**
 * Base URL for the main (non-blog) app, used to build cross-app links from
 * the blog. In production the blog lives on the `blog.` subdomain, so links
 * to the app must be absolute. In development/preview the whole app is served
 * from a single origin, so an empty string keeps links relative (which is what
 * makes them work behind the preview proxy).
 */
export function getMainAppUrl(): string {
  if (process.env.NODE_ENV === "production") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://applyos.io"
    return appUrl.replace(/\/$/, "")
  }
  return ""
}

export function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
}

/**
 * Estimate reading time
 */
export function getReadingTime(content: string): string {
    const wordsPerMinute = 200
    const words = content.trim().split(/\s+/).length
    const minutes = Math.ceil(words / wordsPerMinute)
    return `${minutes} min read`
}
