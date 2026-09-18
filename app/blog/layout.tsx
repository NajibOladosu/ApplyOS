import Image from "next/image"
import Link from "next/link"
import { Metadata } from "next"
import { BlogSettingsButton } from "@/components/blog-settings-button"
import { getMainAppUrl } from "@/lib/blog"

export const metadata: Metadata = {
    title: {
        default: "ApplyOS Blog",
        template: "%s | ApplyOS Blog",
    },
    description: "Insights, tutorials, and updates from the ApplyOS team on AI-powered job applications, career tech, and the future of job searching.",
    openGraph: {
        type: "website",
        siteName: "ApplyOS Blog",
        url: "https://blog.applyos.io",
    },
    alternates: {
        canonical: "https://blog.applyos.io",
    },
}

export default function BlogLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const appUrl = getMainAppUrl()
    // Blog's own base path: "/" on the blog subdomain in production,
    // "/blog" when served from the single dev/preview origin.
    const blogBase = process.env.NODE_ENV === "production" ? "/" : "/blog"
    return (
        <div className="min-h-screen bg-background">
            {/* Blog Navigation */}
            <nav className="fixed top-0 w-full z-50 border-b border-border bg-background/80 backdrop-blur-xl">
                <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href={blogBase} className="flex items-center space-x-2">
                        <Image src="/ApplyOS%20Logo.webp" alt="ApplyOS" width={1073} height={1000} className="h-8 w-auto" />
                        <span className="font-display text-xl font-bold tracking-tight">
                            <span className="text-primary-strong dark:text-primary">Apply</span>
                            <span className="text-foreground">OS</span>
                            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                                Blog
                            </span>
                        </span>
                    </Link>

                    <div className="flex items-center space-x-4">
                        <Link
                            href={`${appUrl}/`}
                            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            ← Back to ApplyOS
                        </Link>
                        <Link
                            href={`${appUrl}/auth/signup`}
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_rgba(24,187,112,0.5)] transition-all hover:-translate-y-0.5 hover:bg-primary-strong dark:hover:bg-primary"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-24 pb-16">
                {children}
            </main>

            {/* Floating Settings Button */}
            <BlogSettingsButton />

            {/* Blog Footer */}
            <footer className="bg-card border-t border-border py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="flex items-center justify-center space-x-2 mb-4">
                        <Image src="/ApplyOS%20Logo.webp" alt="ApplyOS" width={1073} height={1000} className="h-6 w-auto" />
                        <span className="font-display text-lg font-bold tracking-tight text-foreground">
                            <span className="text-primary-strong dark:text-primary">Apply</span>OS
                        </span>
                    </div>
                    <p className="text-muted-foreground text-sm mb-6">
                        The Operating System for Your Job Search
                    </p>
                    <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
                        <Link href={`${appUrl}/`} className="hover:text-primary transition-colors">
                            Main Site
                        </Link>
                        <Link href={`${appUrl}/privacy`} className="hover:text-primary transition-colors">
                            Privacy
                        </Link>
                        <Link href={`${appUrl}/terms`} className="hover:text-primary transition-colors">
                            Terms
                        </Link>
                    </div>
                    <p className="text-muted-foreground text-xs mt-8">
                        © {new Date().getFullYear()} ApplyOS. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    )
}
