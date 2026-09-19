"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { BookOpen, Send } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { GlossaryView } from "@/modules/resources/components/GlossaryView"
import { OutreachTemplatesView } from "@/modules/resources/components/OutreachTemplatesView"

export default function ResourcesPage() {
  const [tab, setTab] = useState("glossary")

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6">
        <PageHeader
          overline="Reference"
          title="Resources"
          description="The vocabulary of a hiring process, and templates for the messages around it."
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-fit border-0 bg-muted/70 p-1">
            <TabsTrigger value="glossary" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Glossary
            </TabsTrigger>
            <TabsTrigger value="outreach" className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              Outreach templates
            </TabsTrigger>
          </TabsList>
          <TabsContent value="glossary" className="mt-0">
            <GlossaryView />
          </TabsContent>
          <TabsContent value="outreach" className="mt-0">
            <OutreachTemplatesView />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
