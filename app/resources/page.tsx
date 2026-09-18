"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { BookOpen } from "lucide-react"
import { GlossaryView } from "@/modules/resources/components/GlossaryView"
import { OutreachTemplatesView } from "@/modules/resources/components/OutreachTemplatesView"

export default function ResourcesPage() {
  const [tab, setTab] = useState("glossary")

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary-strong dark:text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Resources
            </h1>
            <p className="text-sm text-muted-foreground">
              Reference material to speed up your job search.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-fit border-0 bg-muted/70 p-1">
            <TabsTrigger value="glossary">Glossary</TabsTrigger>
            <TabsTrigger value="outreach">Outreach Templates</TabsTrigger>
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
