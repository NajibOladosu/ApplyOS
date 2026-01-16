import { notFound } from "next/navigation"
import Link from "next/link"
import { Metadata } from "next"
import { getPostBySlug, getAllPostSlugs, formatDate, getReadingTime } from "@/lib/blog"
import { MDXRemote } from 'next-mdx-remote/rsc'
import { ArrowLeft, Calendar, Clock, Share2, Twitter, Linkedin } from "lucide-react"
import { Button } from "@/shared/ui/button"

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

    // Define custom components for MDX
    const components = {
        h1: (props: any) => <h1 className="text-3xl font-bold mt-8 mb-4" {...props} />,
        h2: (props: any) => <h2 className="text-2xl font-bold mt-8 mb-4" {...props} />,
        h3: (props: any) => <h3 className="text-xl font-bold mt-6 mb-3" {...props} />,
        p: (props: any) => <p className="text-muted-foreground leading-relaxed my-4" {...props} />,
        a: (props: any) => <a className="text-primary hover:underline" {...props} />,
        ul: (props: any) => <ul className="list-disc list-inside my-4 space-y-2" {...props} />,
        ol: (props: any) => <ol className="list-decimal list-inside my-4 space-y-2" {...props} />,
        li: (props: any) => <li className="ml-4 text-muted-foreground" {...props} />,
        blockquote: (props: any) => <blockquote className="border-l-4 border-primary/50 pl-4 italic my-4 text-muted-foreground" {...props} />,
        hr: (props: any) => <hr className="my-8 border-border" {...props} />,
        pre: (props: any) => <pre className="bg-secondary/50 p-4 rounded-lg overflow-x-auto my-4 text-sm" {...props} />,
        code: (props: any) => <code className="bg-secondary/50 px-1 py-0.5 rounded text-sm font-mono" {...props} />,
    }

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
            <div className="prose prose-invert max-w-none">
                <MDXRemote source={post.content} components={components} />
            </div>

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
