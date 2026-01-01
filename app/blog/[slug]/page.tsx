import { notFound } from "next/navigation"
import Link from "next/link"
import { Metadata } from "next"
import { getPostBySlug, getAllPostSlugs, formatDate, getReadingTime } from "@/lib/blog"
import { ArrowLeft, Calendar, Clock, Share2, Twitter, Linkedin } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BlogPostPageProps {
    params: Promise<{ slug: string }>
}

// Generate static params for all blog posts
export async function generateStaticParams() {
    const slugs = await getAllPostSlugs()
    return slugs.map((slug) => ({ slug }))
}

// Generate SEO metadata for each post
export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
    const { slug } = await params
    const post = await getPostBySlug(slug)

    if (!post) {
        return {
            title: "Post Not Found | ApplyOS Blog",
        }
    }

    return {
        title: `${post.title} | ApplyOS Blog`,
        description: post.excerpt,
        alternates: {
            canonical: `https://blog.applyos.io/${slug}`,
        },
        openGraph: {
            type: "article",
            title: post.title,
            description: post.excerpt,
            url: `https://blog.applyos.io/${slug}`,
            siteName: "ApplyOS Blog",
            publishedTime: post.date,
            authors: [post.author.name],
            images: post.coverImage ? [{ url: post.coverImage }] : [],
        },
        twitter: {
            card: "summary_large_image",
            title: post.title,
            description: post.excerpt,
            images: post.coverImage ? [post.coverImage] : [],
        },
    }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
    const { slug } = await params
    const post = await getPostBySlug(slug)

    if (!post) {
        notFound()
    }

    // Parse MDX content to HTML (simple conversion for now)
    // For a full MDX solution, you'd use next-mdx-remote or similar
    const contentHtml = post.content
        .split('\n\n')
        .map((paragraph, index) => {
            // Handle headers
            if (paragraph.startsWith('# ')) {
                return `<h1 class="text-3xl font-bold mt-8 mb-4">${paragraph.slice(2)}</h1>`
            }
            if (paragraph.startsWith('## ')) {
                return `<h2 class="text-2xl font-bold mt-8 mb-4">${paragraph.slice(3)}</h2>`
            }
            if (paragraph.startsWith('### ')) {
                return `<h3 class="text-xl font-bold mt-6 mb-3">${paragraph.slice(4)}</h3>`
            }

            // Handle code blocks
            if (paragraph.startsWith('```')) {
                const lines = paragraph.split('\n')
                const code = lines.slice(1, -1).join('\n')
                return `<pre class="bg-secondary/50 p-4 rounded-lg overflow-x-auto my-4"><code>${code}</code></pre>`
            }

            // Handle lists
            if (paragraph.startsWith('- ')) {
                const items = paragraph.split('\n').map(item =>
                    `<li class="ml-4">${item.slice(2)}</li>`
                ).join('')
                return `<ul class="list-disc list-inside my-4 space-y-2">${items}</ul>`
            }

            // Handle horizontal rules
            if (paragraph.trim() === '---') {
                return '<hr class="my-8 border-border" />'
            }

            // Handle emphasis and bold
            let formatted = paragraph
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-primary hover:underline">$1</a>')

            // Regular paragraphs
            return `<p class="text-muted-foreground leading-relaxed my-4">${formatted}</p>`
        })
        .join('')

    const shareUrl = `https://blog.applyos.io/${slug}`
    const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(shareUrl)}`
    const linkedinShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`

    return (
        <article className="container mx-auto px-6 max-w-3xl">
            {/* Back Link */}
            <Link
                href="/"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to all posts
            </Link>

            {/* Article Header */}
            <header className="mb-12">
                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                        {post.tags.map((tag) => (
                            <span
                                key={tag}
                                className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                    {post.title}
                </h1>

                <p className="text-xl text-muted-foreground mb-6">
                    {post.excerpt}
                </p>

                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground border-b border-border pb-6">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-primary font-bold">
                                {post.author.name.charAt(0)}
                            </span>
                        </div>
                        <span>{post.author.name}</span>
                    </div>
                    <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(post.date)}
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {getReadingTime(post.content)}
                    </span>
                </div>
            </header>

            {/* Article Content */}
            <div
                className="prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
            />

            {/* Share Section */}
            <div className="mt-12 pt-8 border-t border-border">
                <div className="flex items-center justify-between">
                    <p className="text-muted-foreground flex items-center gap-2">
                        <Share2 className="h-4 w-4" />
                        Share this article
                    </p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <a href={twitterShareUrl} target="_blank" rel="noopener noreferrer">
                                <Twitter className="h-4 w-4 mr-2" />
                                Twitter
                            </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <a href={linkedinShareUrl} target="_blank" rel="noopener noreferrer">
                                <Linkedin className="h-4 w-4 mr-2" />
                                LinkedIn
                            </a>
                        </Button>
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="mt-12 p-8 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 text-center">
                <h3 className="text-2xl font-bold mb-2">Ready to apply smarter?</h3>
                <p className="text-muted-foreground mb-6">
                    Stop wasting time on repetitive applications. Let AI do the heavy lifting.
                </p>
                <Link
                    href="https://applyos.io/auth/signup"
                    className="inline-flex items-center gap-2 bg-primary text-[#0a0a0a] font-bold px-6 py-3 rounded-md hover:bg-primary/90 transition-colors"
                >
                    Try ApplyOS Free
                </Link>
            </div>
        </article>
    )
}
