import React from 'react'
import { Alert } from 'antd'

interface Props {
  children: React.ReactNode
  // Shown in the fallback so the user knows what failed to print/preview.
  label?: string
}

interface State {
  error: Error | null
}

// A bad/null field in a print component's data (e.g. a nullable remark)
// used to throw during render and, with no boundary anywhere above it,
// unmount the entire page — not just the print preview. This keeps that
// failure contained to the print section so the rest of the page (and any
// other action the user might take, like navigating back) stays usable.
class PrintErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[PrintErrorBoundary] print view crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <Alert
          type="error"
          showIcon
          style={{ borderRadius: 8 }}
          message={`ไม่สามารถแสดงตัวอย่างการพิมพ์${this.props.label ? `: ${this.props.label}` : ''}ได้`}
          description={this.state.error.message}
        />
      )
    }
    return this.props.children
  }
}

export default PrintErrorBoundary
