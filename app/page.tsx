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
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center p-1.5">
              <img src="/logo-icon.svg" alt="A" className="w-full h-full" />
            </div>
            <span className="text-xl font-bold">
              <span className="text-primary">Apply</span>
              <span className="text-white">OS</span>
            </span>
          </Link>

          <div className="flex items-center space-x-4">
            <Button variant="outline" asChild className="text-white border-white/20 hover:border-primary hover:bg-primary hover:text-[#0a0a0a] transition-all">
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button asChild className="bg-primary text-[#0a0a0a] font-bold hover:bg-primary/90">
              <Link href="/auth/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20 px-6 text-center">
        {/* Background Glow Effect behind the text */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] bg-primary/20 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="container mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* The "Terminal Badge" */}
            <div className="mb-8 flex justify-center">
              <span className="rounded-full bg-primary/10 px-4 py-1 text-sm font-mono font-semibold text-primary ring-1 ring-inset ring-primary/30">
                &gt; System_Online: v1.0
              </span>
            </div>

            {/* H1: High Contrast White + Neon */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight tracking-tight text-white">
              The Operating System for
              <br />
              <span className="text-primary drop-shadow-[0_0_15px_rgba(0,255,136,0.25)]">
                Your Job Search
              </span>
            </h1>

            {/* Subheadline: Light Gray for readability on Dark */}
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-8">
              Stop juggling spreadsheets. <span className="text-white font-semibold">ApplyOS</span> parses job URLs,
              auto-generates targeted AI responses, and executes your application pipeline from one command center.
            </p>

            {/* CTAs: Neon Button + Ghost Button */}
            <div className="flex items-center justify-center space-x-6">
              <Button
                size="lg"
                asChild
                className="bg-primary text-[#0a0a0a] font-bold hover:bg-primary/90 shadow-[0_0_20px_rgba(0,255,136,0.3)] hover:shadow-[0_0_30px_rgba(0,255,136,0.5)] transition-all duration-200"
              >
                <Link href="/auth/signup">Get Started</Link>
              </Button>

              <Button
                variant="outline"
                size="lg"
                asChild
                className="text-white border-white/20 hover:border-primary hover:bg-primary hover:text-[#0a0a0a] group transition-all"
              >
                <Link href="#how-it-works" className="flex items-center gap-2">
                  <span>View Workflow</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rotate-90" aria-hidden="true" />
                </Link>
              </Button>
            </div>

            {/* Social Proof: Darker muted text */}
            <div className="mt-16 pt-8 border-t border-white/5">
              <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase font-mono">
                Optimized for high-performance candidates
              </p>
            </div>
          </motion.div>
        </div>
      </section>


      {/* Features Section */}
      < section id="features" className="py-20 px-6 bg-secondary/30" >
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
      </section >

      {/* How It Works Section */}
      < section className="py-20 px-6" >
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
      </section >

      {/* CTA Section */}
      < section className="py-20 px-6 bg-secondary/30" >
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
                className="bg-primary text-[#0a0a0a] font-bold hover:bg-primary/90 shadow-[0_0_20px_rgba(0,255,136,0.3)] hover:shadow-[0_0_30px_rgba(0,255,136,0.5)] transition-all duration-200"
              >
                <Link href="/auth/signup" className="flex items-center gap-2">
                  <span>Get Started</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section >

      {/* Footer */}
      < footer className="border-t border-border py-12 px-6" >
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center p-1.5">
                <img src="/logo-icon.svg" alt="A" className="w-full h-full" />
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
      </footer >
    </div >
  )
}
