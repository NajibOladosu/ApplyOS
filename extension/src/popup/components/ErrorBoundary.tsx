import React, { Component, ErrorInfo, ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'

interface Props {
    children: ReactNode
    fallback?: ReactNode
    onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Extension error boundary caught:', error, errorInfo)
        this.props.onError?.(error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <div className="icon-chip h-10 w-10 !border-destructive/25 !bg-destructive/10 !text-destructive">
                        <TriangleAlert className="h-5 w-5" />
                    </div>
                    <p className="font-display text-[13px] font-bold tracking-tight text-foreground">Something went wrong</p>
                    <p className="max-w-[250px] text-[11px] leading-relaxed text-muted-foreground">
                        {this.state.error?.message || 'An unexpected error occurred'}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="btn-primary h-8 !px-4 !text-[12px]"
                    >
                        Try again
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}
