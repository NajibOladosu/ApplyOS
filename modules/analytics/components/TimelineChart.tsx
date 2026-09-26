'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'

interface TimelineDataPoint {
  date: string
  count: number
}

interface TimelineChartProps {
  data: TimelineDataPoint[]
  title?: string
  subtitle?: string
}

export function TimelineChart({ data, title = 'Applications Over Time', subtitle }: TimelineChartProps) {
  // Format data for display
  const formattedData = (data ?? []).map(point => ({
    ...point,
    displayDate: format(parseISO(point.date), 'MMM d'),
  }))

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] flex-col rounded-2xl border border-border/70 bg-card">
        <div className="border-b border-border/60 px-5 py-4">
          <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-8">
          <p className="text-sm text-muted-foreground">No timeline data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-2xl border border-border/70 bg-card">
      <div className="border-b border-border/60 px-5 py-4">
        <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="min-h-0 flex-1 p-4 sm:p-5">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={formattedData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorCount" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#18BB70" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#18BB70" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="displayDate"
              className="text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'var(--foreground)' }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#18BB70"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCount)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
