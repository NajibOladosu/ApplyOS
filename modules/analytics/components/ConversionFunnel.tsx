'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'

interface ConversionFunnelStage {
  stage: string
  count: number
  percentage: number
}

interface ConversionFunnelProps {
  data: ConversionFunnelStage[]
  title?: string
}

export function ConversionFunnel({ data, title = 'Application Conversion Funnel' }: ConversionFunnelProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="flex flex-col h-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">
            No funnel data available
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calculate max width for the first stage (100%)
  const maxCount = data[0]?.count || 1

  // Color gradient from blue to green
  const colors = [
    '#3b82f6', // blue
    '#06b6d4', // cyan
    '#10b981', // emerald
    '#84cc16', // lime
    '#00FF88', // green (app accent)
  ]

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {data.map((stage, index) => {
          const widthPercentage = (stage.count / maxCount) * 100
          const color = colors[index % colors.length]

          return (
            <div key={stage.stage} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{stage.stage}</span>
                <span className="text-muted-foreground">
                  {stage.count} ({stage.percentage}%)
                </span>
              </div>
              <div className="relative h-12 bg-secondary/20 rounded-lg overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-lg flex items-center justify-center text-sm font-medium text-slate-900 transition-all duration-500"
                  style={{
                    width: `${widthPercentage}%`,
                    backgroundColor: color,
                  }}
                >
                  {widthPercentage > 15 && (
                    <span className="px-2">{stage.count} applications</span>
                  )}
                </div>
              </div>
              {/* Drop-off indicator */}
              {index < data.length - 1 && data[index + 1] && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  <span>
                    {stage.count - data[index + 1].count} dropped
                    ({Math.round(((stage.count - data[index + 1].count) / stage.count) * 100)}% drop-off)
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
