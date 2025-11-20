'use client'

import { useEffect, useRef } from 'react'
import { sankey, sankeyLinkHorizontal, SankeyGraph, SankeyNode, SankeyLink } from 'd3-sankey'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SankeyData {
  nodes: Array<{ name: string; value?: number }>
  links: Array<{ source: number; target: number; value: number }>
}

interface SankeyChartProps {
  data: SankeyData
  title?: string
}

// Status colors matching the app theme
const STATUS_COLORS: Record<string, string> = {
  Draft: '#6b7280', // gray
  Submitted: '#3b82f6', // blue
  'In review': '#8b5cf6', // purple
  Interview: '#f59e0b', // amber
  Offer: '#00FF88', // green (app accent)
  Rejected: '#ef4444', // red
  'Not Submitted': '#9ca3af', // light gray
  Pending: '#d1d5db', // lighter gray
}

export function SankeyChart({ data, title = 'Application Status Flow' }: SankeyChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !data) return

    const svg = svgRef.current
    const width = svg.clientWidth
    const height = svg.clientHeight

    // Clear previous content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild)
    }

    // Handle empty data case - manually position all nodes
    if (data.nodes.length === 0 || data.links.length === 0) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      svg.appendChild(g)

      // Manually position nodes in a horizontal line when there are no links
      const nodeCount = data.nodes.length || 6 // Always show at least 6 nodes
      const nodeWidth = 15
      const nodeHeight = 40
      const spacing = (width - 40) / (nodeCount - 1 || 1)
      const startY = height / 2 - nodeHeight / 2

      data.nodes.forEach((nodeData, i) => {
        const x = 20 + i * spacing - nodeWidth / 2
        const y = startY

        // Draw node rectangle
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        rect.setAttribute('x', String(x))
        rect.setAttribute('y', String(y))
        rect.setAttribute('width', String(nodeWidth))
        rect.setAttribute('height', String(nodeHeight))
        rect.setAttribute('fill', STATUS_COLORS[nodeData.name] || '#64748b')
        rect.setAttribute('rx', '3')
        rect.setAttribute('opacity', nodeData.value === 0 ? '0.4' : '1')

        // Tooltip
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
        title.textContent = `${nodeData.name}: ${nodeData.value || 0}`
        rect.appendChild(title)

        g.appendChild(rect)

        // Add label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        text.setAttribute('x', String(x + nodeWidth / 2))
        text.setAttribute('y', String(y + nodeHeight + 15))
        text.setAttribute('text-anchor', 'middle')
        text.setAttribute('font-size', '11')
        text.setAttribute('fill', 'currentColor')
        text.setAttribute('class', 'fill-foreground')
        text.textContent = `${nodeData.name} (${nodeData.value || 0})`

        g.appendChild(text)
      })

      return
    }

    // Create Sankey generator
    const sankeyGenerator = sankey<SankeyNode<{ name: string }, {}>, SankeyLink<SankeyNode<{ name: string }, {}>, {}>>()
      .nodeWidth(15)
      .nodePadding(20)
      .extent([
        [20, 20],
        [width - 20, height - 20],
      ])

    // Generate layout
    const graph: SankeyGraph<{ name: string }, {}> = sankeyGenerator({
      nodes: data.nodes.map(d => ({ ...d })),
      links: data.links.map(d => ({ ...d })),
    })

    // Create SVG group
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    svg.appendChild(g)

    // Draw links
    graph.links.forEach(link => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      const pathData = sankeyLinkHorizontal()(link)

      if (pathData) {
        path.setAttribute('d', pathData)
        path.setAttribute('stroke', '#94a3b8')
        path.setAttribute('stroke-opacity', '0.3')
        path.setAttribute('stroke-width', String(Math.max(1, link.width || 0)))
        path.setAttribute('fill', 'none')

        // Add hover effect
        path.addEventListener('mouseenter', () => {
          path.setAttribute('stroke-opacity', '0.6')
        })
        path.addEventListener('mouseleave', () => {
          path.setAttribute('stroke-opacity', '0.3')
        })

        // Tooltip
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
        title.textContent = `${(link.source as any).name} → ${(link.target as any).name}: ${link.value}`
        path.appendChild(title)

        g.appendChild(path)
      }
    })

    // Draw nodes
    graph.nodes.forEach(node => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('x', String(node.x0 || 0))
      rect.setAttribute('y', String(node.y0 || 0))
      rect.setAttribute('width', String((node.x1 || 0) - (node.x0 || 0)))
      rect.setAttribute('height', String((node.y1 || 0) - (node.y0 || 0)))
      rect.setAttribute('fill', STATUS_COLORS[(node as any).name] || '#64748b')
      rect.setAttribute('rx', '3')

      // Add hover effect
      rect.addEventListener('mouseenter', () => {
        rect.setAttribute('opacity', '0.8')
      })
      rect.addEventListener('mouseleave', () => {
        rect.setAttribute('opacity', '1')
      })

      // Get the custom value from original data if available
      const nodeIndex = graph.nodes.indexOf(node)
      const customValue = data.nodes[nodeIndex]?.value
      const displayValue = customValue !== undefined ? customValue : (node.value || 0)

      // Tooltip
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
      title.textContent = `${(node as any).name}: ${displayValue}`
      rect.appendChild(title)

      g.appendChild(rect)

      // Add label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      const x = (node.x0 || 0) < width / 2 ? (node.x1 || 0) + 6 : (node.x0 || 0) - 6
      const y = ((node.y0 || 0) + (node.y1 || 0)) / 2

      text.setAttribute('x', String(x))
      text.setAttribute('y', String(y))
      text.setAttribute('dy', '0.35em')
      text.setAttribute('text-anchor', (node.x0 || 0) < width / 2 ? 'start' : 'end')
      text.setAttribute('font-size', '12')
      text.setAttribute('fill', 'currentColor')
      text.setAttribute('class', 'fill-foreground')
      text.textContent = `${(node as any).name} (${displayValue})`

      g.appendChild(text)
    })
  }, [data])

  // Show "no data" message when there are no nodes
  if (!data || data.nodes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            No data to display application status flow
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <svg ref={svgRef} className="w-full h-[400px]" />
      </CardContent>
    </Card>
  )
}
