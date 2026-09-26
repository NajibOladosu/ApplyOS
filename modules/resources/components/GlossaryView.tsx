"use client"

import { useMemo, useState } from "react"
import { Card, CardContent } from "@/shared/ui/card"
import { Input } from "@/shared/ui/input"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { Search } from "lucide-react"
import { EmptyState } from "@/components/data/empty-state"
import { GLOSSARY, type GlossaryTerm } from "@/modules/resources/lib/glossary"

const CATEGORIES = ["All", "Process", "Documents", "Interview", "Compensation", "Systems"] as const
type Category = (typeof CATEGORIES)[number]

export function GlossaryView() {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<Category>("All")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return GLOSSARY.filter((t: GlossaryTerm) => {
      const matchesCategory = category === "All" || t.category === category
      const matchesQuery =
        !q ||
        t.term.toLowerCase().includes(q) ||
        t.abbreviation?.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q)
      return matchesCategory && matchesQuery
    }).sort((a, b) => a.term.localeCompare(b.term))
  }, [query, category])

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border/70">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search a term, abbreviation or definition..."
              className="h-10 rounded-lg border-border/70 bg-muted/40 pl-10 focus-visible:bg-background"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                aria-pressed={category === cat}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  category === cat
                    ? "border-primary/40 bg-primary/12 text-primary-strong dark:text-primary"
                    : "border-border/70 text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground/80">
              {filtered.length} of {GLOSSARY.length} terms
            </span>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title="No terms match that"
          description="Try a shorter query, or clear the category filter to search the whole glossary."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("")
                setCategory("All")
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden rounded-2xl border-border/70">
          <ul className="divide-y divide-border/50">
            {filtered.map((t) => (
              <li key={t.term} className="group px-5 py-4 transition-colors hover:bg-muted/30">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    {t.term}
                    {t.abbreviation && (
                      <span className="ml-2 rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 align-middle font-mono text-[10px] font-medium tracking-wide text-muted-foreground">
                        {t.abbreviation}
                      </span>
                    )}
                  </h3>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-border/70 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    {t.category}
                  </Badge>
                </div>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {t.definition}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
