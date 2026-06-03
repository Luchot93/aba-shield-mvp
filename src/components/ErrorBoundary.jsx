import React from 'react';

/**
 * Generic React Error Boundary.
 *
 * Usage:
 *   <ErrorBoundary label="Assessment">
 *     <AssessmentFeature ... />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary:${this.props.label ?? 'App'}]`, error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const label = this.props.label ?? 'This section';

    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4 px-6 py-12 text-center"
        style={{ fontFamily: 'DM Sans, sans-serif' }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.1)' }}>
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor"
            strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800 mb-1">{label} encountered an error</p>
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
        </div>
        <button
          onClick={() => this.setState({ hasError: false, error: null })}
          className="text-xs font-semibold px-4 py-2 rounded-xl text-white"
          style={{ background: '#0D9488' }}>
          Try again
        </button>
      </div>
    );
  }
}
