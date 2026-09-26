import Link from "next/link"
import { getAllPosts, formatDate, getReadingTime, getMainAppUrl } from "@/lib/blog"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { ArrowRight, Clock, Calendar } from "lucide-react"

export default async function BlogHomePage() {
    const posts = await getAllPosts()
    const appUrl = getMainAppUrl()
    // Post href prefix: "" on the blog subdomain in production, "/blog" in dev/preview.
    const postBase = process.env.NODE_ENV === "production" ? "" : "/blog"

    return (
        <div className="container mx-auto px-6">
            {/* Hero Section */}
            <div className="mb-14 text-center">
                <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary-strong dark:text-primary">
                    Insights · Tutorials · Updates
                </span>
                <h1 className="font-display mx-auto mb-4 max-w-3xl text-4xl font-bold tracking-tight text-foreground md:text-5xl md:leading-[1.05]">
                    The ApplyOS <span className="text-gradient">Blog</span>
                </h1>
                <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                    Insights, tutorials, and updates on AI-powered job applications
                    and the future of career tech.
                </p>
            </div>

            {/* Blog Posts Grid */}
            {posts.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-muted-foreground">No blog posts yet. Check back soon!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {posts.map((post) => (
                        <Link key={post.slug} href={`${postBase}/${post.slug}`}>
                            <Card className="group h-full cursor-pointer overflow-hidden rounded-2xl border-border/70 transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_12px_32px_-16px_rgba(24,187,112,0.35)]">
                                {/* Cover Image */}
                                <div className="relative flex aspect-[16/7] items-center justify-center overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-teal-500/10">
                                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-background/80 backdrop-blur-sm">
                                        <span className="font-display text-lg font-bold text-primary-strong dark:text-primary">
                                            {post.title.charAt(0)}
                                        </span>
                                    </div>
                                </div>

                                <CardHeader>
                                    {/* Tags */}
                                    {post.tags && post.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {post.tags.slice(0, 2).map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <CardTitle className="font-display text-lg font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary-strong dark:group-hover:text-primary line-clamp-2">
                                        {post.title}
                                    </CardTitle>

                                    <CardDescription className="line-clamp-3">
                                        {post.excerpt}
                                    </CardDescription>
                                </CardHeader>

                                <CardContent>
                                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                                        <div className="flex items-center gap-4">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {formatDate(post.date)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {getReadingTime(post.content)}
                                            </span>
                                        </div>
                                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform text-primary" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}

            {/* CTA Section */}
            <div className="mt-20 text-center">
                <Card className="mx-auto max-w-2xl rounded-2xl border-primary/20 bg-gradient-to-b from-primary/10 to-primary/5 shadow-[0_16px_48px_-24px_rgba(24,187,112,0.4)]">
                    <CardContent className="p-8 text-center sm:p-10">
                        <h2 className="font-display mb-2 text-2xl font-bold tracking-tight text-foreground">
                            Ready to transform your job search?
                        </h2>
                        <p className="mb-6 text-muted-foreground">
                            Join thousands of users applying smarter with ApplyOS.
                        </p>
                        <Button asChild className="rounded-lg bg-primary px-6 font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_rgba(24,187,112,0.5)] transition-all hover:-translate-y-0.5 hover:bg-primary-strong dark:hover:bg-primary">
                            <Link href={`${appUrl}/auth/signup`}>
                                Get Started Free
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
