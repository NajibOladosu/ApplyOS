import { BlogSettingsButton } from "@/components/blog-settings-button"
import { MarketingNav } from "@/components/marketing/nav"
import { Hero } from "@/components/marketing/hero"
import { TrustStrip } from "@/components/marketing/trust-strip"
import { FeaturesBento } from "@/components/marketing/bento"
import { HowItWorks } from "@/components/marketing/how-it-works"
import { ExtensionSection } from "@/components/marketing/extension"
import { FinalCta } from "@/components/marketing/final-cta"
import { MarketingFooter } from "@/components/marketing/footer"

export default function Home() {
  return (
    <div className="icons-outline min-h-screen bg-background">
      <MarketingNav />
      <main>
        <Hero />
        <TrustStrip />
        <FeaturesBento />
        <HowItWorks />
        <ExtensionSection />
        <FinalCta />
      </main>
      <MarketingFooter />
      <BlogSettingsButton />
    </div>
  )
}
