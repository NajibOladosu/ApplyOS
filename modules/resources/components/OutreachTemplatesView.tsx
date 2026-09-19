"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Badge } from "@/shared/ui/badge"
import { useToast } from "@/shared/ui/use-toast"
import { Copy } from "lucide-react"
import {
  OUTREACH_TEMPLATES,
  OUTREACH_FIELDS,
  fillTemplate,
  type OutreachVars,
} from "@/modules/resources/lib/outreach"

const EMPTY_VARS: OutreachVars = {
  company: "",
  role: "",
  contact: "",
  yourName: "",
  highlight: "",
}

export function OutreachTemplatesView() {
  const { toast } = useToast()
  const [selectedId, setSelectedId] = useState(OUTREACH_TEMPLATES[0].id)
  const [vars, setVars] = useState<OutreachVars>(EMPTY_VARS)

  const template = useMemo(
    () => OUTREACH_TEMPLATES.find((t) => t.id === selectedId) ?? OUTREACH_TEMPLATES[0],
    [selectedId]
  )

  const filledSubject = fillTemplate(template.subject, vars)
  const filledBody = fillTemplate(template.body, vars)

  const setVar = (key: keyof OutreachVars, value: string) =>
    setVars((prev) => ({ ...prev, [key]: value }))

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: `${label} copied` })
    } catch {
      toast({ title: "Couldn't copy", variant: "destructive" })
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      {/* Left: template index */}
      <Card className="h-fit overflow-hidden rounded-2xl border-border/70">
        <div className="border-b border-border/50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
            Templates
          </p>
        </div>
        <ul className="p-1.5">
          {OUTREACH_TEMPLATES.map((t) => {
            const active = t.id === selectedId
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  aria-pressed={active}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                    active ? "bg-primary/[0.08] text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        active ? "bg-primary" : "bg-border"
                      }`}
                    />
                    <span className="truncate text-sm font-medium">{t.name}</span>
                  </span>
                  <span className="mt-0.5 block pl-3.5 text-xs text-muted-foreground/80">
                    {t.audience}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </Card>

      <div className="space-y-4">
        {/* Fields */}
        <Card className="rounded-2xl border-border/70">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            {OUTREACH_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label
                  htmlFor={field.key}
                  className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70"
                >
                  {field.label}
                </Label>
                <Input
                  id={field.key}
                  placeholder={field.placeholder}
                  value={vars[field.key]}
                  onChange={(e) => setVar(field.key, e.target.value)}
                  className="rounded-lg border-border/70 bg-muted/40 focus-visible:bg-background"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="rounded-2xl border-border/70">
          <div className="flex flex-row items-center justify-between gap-3 border-b border-border/50 px-5 py-3">
            <p className="text-sm font-semibold text-foreground">Preview</p>
            <Button
              size="sm"
              className="h-8 rounded-lg"
              onClick={() => copy(`Subject: ${filledSubject}\n\n${filledBody}`, "Email")}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy email
            </Button>
          </div>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                Subject
              </span>
              <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm font-medium">
                {filledSubject}
              </p>
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                Body
              </span>
              <p className="whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/30 px-3 py-3 text-sm leading-relaxed">
                {filledBody}
              </p>
            </div>
            <p className="border-t border-border/50 pt-3 text-xs leading-relaxed text-muted-foreground">
              Anything still in{" "}
              <span className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">[brackets]</span>{" "}
              is a field you have not filled in yet.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
