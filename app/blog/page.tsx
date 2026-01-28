import Link from "next/link"
import { getAllPosts, formatDate, getReadingTime } from "@/lib/blog"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { ArrowRight, Clock, Calendar } from "lucide-react"

export default async function BlogHomePage() {
    const posts = await getAllPosts()

    return (
        <div className="container mx-auto px-6">
            {/* Hero Section */}
            <div className="text-center mb-16">
                <h1 className="text-4xl md:text-5xl font-bold mb-4">
                    ApplyOS <span className="text-primary">Blog</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
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
                        <Link key={post.slug} href={`/${post.slug}`}>
                            <Card className="h-full hover:border-primary/40 transition-all group cursor-pointer">
                                {/* Cover Image */}
                                <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 relative overflow-hidden">
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <span className="text-2xl font-bold text-primary font-mono">
                                                {post.title.charAt(0)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <CardHeader>
                                    {/* Tags */}
                                    {post.tags && post.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {post.tags.slice(0, 2).map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <CardTitle className="group-hover:text-primary transition-colors line-clamp-2">
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
                <Card className="max-w-2xl mx-auto glass-effect border-primary/20">
                    <CardContent className="p-8">
                        <h2 className="text-2xl font-bold mb-2">
                            Ready to transform your job search?
                        </h2>
                        <p className="text-muted-foreground mb-6">
                            Join thousands of users applying smarter with ApplyOS.
                        </p>
                        <Button asChild className="font-bold text-primary-foreground">
                            <Link href="https://applyos.io/auth/signup">
                                Get Started Free
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
