'use client'

interface ConversionFunnelStage {
  stage: string
  count: number
  percentage: number
}

interface ConversionFunnelProps {
  data: ConversionFunnelStage[]
  title?: string
  subtitle?: string
}

/**
 * Funnel bars step down in the app's primary tone — the previous rainbow
 * palette (blue/cyan/lime) fought the green accent on every other chart.
 */
export function ConversionFunnel({ data, title = 'Application Conversion Funnel', subtitle }: ConversionFunnelProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] flex-col rounded-2xl border border-border/70 bg-card">
        <div className="border-b border-border/60 px-5 py-4">
          <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-8">
          <p className="text-sm text-muted-foreground">No funnel data available</p>
        </div>
      </div>
    )
  }

  // Calculate max width for the first stage (100%)
  const maxCount = data[0]?.count || 1

  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-2xl border border-border/70 bg-card">
      <div className="border-b border-border/60 px-5 py-4">
        <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="flex-1 space-y-4 p-5">
        {data.map((stage, index) => {
          // Only show bar if count > 0, no minimum width for empty stages
          const widthPercentage = stage.count > 0
            ? Math.max((stage.count / maxCount) * 100, 8)
            : 0

          // Dimmer as you go down the funnel — one hue, stepped opacity.
          const opacity = Math.max(1 - index * 0.16, 0.25)

          return (
            <div key={stage.stage} className="space-y-1.5">
              {/* Stage label and count */}
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-foreground">{stage.stage}</span>
                <span className="text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">{stage.count}</span>
                  <span className="tabular-nums"> ({stage.percentage}%)</span>
                </span>
              </div>

              {/* Progress bar */}
              <div className="relative h-7 overflow-hidden rounded-md bg-muted">
                {stage.count > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 h-full rounded-md bg-primary"
                    style={{ width: `${widthPercentage}%`, opacity }}
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className={`text-xs font-semibold tabular-nums ${widthPercentage >= 50
                      ? 'text-primary-foreground'
                      : 'text-foreground'
                      }`}
                  >
                    {stage.count} ({stage.percentage}%)
                  </span>
                </div>
              </div>

              {/* Drop-off indicator */}
              {index < data.length - 1 && data[index + 1] && stage.count > 0 ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-0.5">
                  <span className="flex items-center gap-1 text-muted-foreground/70">
                    <span className="text-destructive/80">↓</span>
                    {Math.round(((stage.count - data[index + 1].count) / stage.count) * 100)}% drop
                  </span>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
