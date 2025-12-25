"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sparkles,
  FileText,
  Brain,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Zap,
  Shield,
  Clock
} from "lucide-react"

const features = [
  {
    icon: Brain,
    title: "AI-Powered Intelligence",
    description: "Automatically extract questions from job postings and generate personalized answers using advanced AI.",
  },
  {
    icon: FileText,
    title: "Document Analysis",
    description: "Upload your resume, transcripts, and certificates. Our AI extracts and organizes your data intelligently.",
  },
  {
    icon: TrendingUp,
    title: "Smart Tracking",
    description: "Track all your applications in one place with status updates, deadlines, and priority management.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Apply to opportunities 10x faster with AI-generated responses tailored to your experience.",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "Your data is encrypted and secured with enterprise-grade protection.",
  },
  {
    icon: Clock,
    title: "Never Miss a Deadline",
    description: "Get smart notifications and reminders for upcoming deadlines and important updates.",
  },
]

const steps = [
  {
    number: "01",
    title: "Upload Your Documents",
    description: "Add your resume, transcripts, and other relevant documents to your profile.",
  },
  {
    number: "02",
    title: "Add Applications",
    description: "Paste the URL of a job posting or scholarship. Our AI extracts all the questions.",
  },
  {
    number: "03",
    title: "AI Generates Answers",
    description: "Get personalized, professional answers based on your documents and experience.",
  },
  {
    number: "04",
    title: "Track & Apply",
    description: "Manage your applications, track progress, and never miss a deadline.",
  },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground" style={{ fontFamily: "var(--font-crimson)" }}>A</span>
            </div>
            <span className="text-xl font-bold">
              <span className="text-primary">Apply</span>
              <span className="text-white">OS</span>
            </span>
          </Link>

          <div className="flex items-center space-x-4">
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/signup">Start Free Trial</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center space-x-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-8">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary font-medium">AI-Powered Application Manager</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Your AI-Powered
              <br />
              <span className="text-gradient">Application Manager</span>
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Automate the way you apply for jobs and scholarships. Extract questions, generate answers, and track everything in one beautiful dashboard.
            </p>

            <div className="flex items-center justify-center space-x-4">
              <Button
                size="lg"
                asChild
                className="glow-effect inline-flex items-center justify-center gap-2"
              >
                <Link href="/auth/signup" className="flex items-center gap-2">
                  <span>Start Free Trial</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="inline-flex items-center justify-center gap-2"
              >
                <Link href="#features">View Features</Link>
              </Button>
            </div>

            <div className="mt-12 flex items-center justify-center space-x-8 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Smart AI Assistance</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Apply 10x Faster</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Unlimited Applications</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-secondary/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Powerful Features</h2>
            <p className="text-xl text-muted-foreground">
              Everything you need to streamline your application process
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="h-full hover:border-primary/40 transition-all hover:glow-effect">
                    <CardHeader>
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <CardTitle>{feature.title}</CardTitle>
                      <CardDescription>{feature.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground">
              Get started in 4 simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="text-6xl font-bold text-primary/10 mb-4">{step.number}</div>
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-secondary/30">
        <div className="container mx-auto">
          <Card className="glass-effect border-primary/20">
            <CardContent className="p-12 text-center">
              <h2 className="text-4xl font-bold mb-4">
                Ready to Transform Your Application Process?
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                Join thousands of users who are applying smarter, not harder.
              </p>
              <Button
                size="lg"
                asChild
                className="glow-effect-strong inline-flex items-center justify-center gap-2"
              >
                <Link href="/auth/signup" className="flex items-center gap-2">
                  <span>Get Started for Free</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-lg font-bold text-primary-foreground" style={{ fontFamily: "var(--font-crimson)" }}>A</span>
              </div>
              <span className="text-xl font-bold">
                <span className="text-primary">Apply</span>
                <span className="text-white">OS</span>
              </span>
            </div>

            <div className="flex items-center gap-6">
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Terms of Service
              </Link>
            </div>

            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ApplyOS. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
