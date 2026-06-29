import { Component, type ErrorInfo, type ReactNode } from "react"

interface Props {
  children: ReactNode
  /** Optional fallback UI. Defaults to a centered error card. */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * React class-based Error Boundary that catches render/lifecycle errors in its
 * child tree. Use it to wrap critical subtrees (e.g. MapContainer) so a single
 * crash doesn't take down the entire application shell.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Wiser] Unhandled render error:", error, info.componentStack)
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className='absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50'>
          <div className='max-w-sm w-full mx-4 p-6 rounded-2xl bg-background/60 backdrop-blur-xl border border-white/10 border-t-white/20 border-l-white/20 shadow-lg flex flex-col gap-3'>
            <div className='flex items-center gap-2 text-destructive'>
              <svg className='size-5 shrink-0' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2}>
                <circle cx='12' cy='12' r='10' />
                <line x1='12' y1='8' x2='12' y2='12' />
                <line x1='12' y1='16' x2='12.01' y2='16' />
              </svg>
              <span className='font-bold text-sm uppercase tracking-wider'>Map Error</span>
            </div>
            <p className='text-xs text-muted-foreground leading-relaxed'>
              The map encountered an unexpected error and could not render. This may be caused by a network issue or browser compatibility.
            </p>
            {this.state.error && (
              <code className='text-[10px] font-mono text-muted-foreground bg-background/40 rounded-lg px-3 py-2 break-all'>
                {this.state.error.message}
              </code>
            )}
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className='mt-1 h-8 rounded-full bg-destructive/80 hover:bg-destructive text-primary-foreground text-xs font-semibold transition-colors cursor-pointer'
            >
              Retry
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
