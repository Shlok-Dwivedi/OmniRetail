import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Workspace rendering failed', error, info.componentStack);
  }
  render() {
    if (this.state.failed)
      return (
        <div className="boot">
          <div className="error-state" role="alert">
            <h1>Your workspace needs a refresh.</h1>
            <p>Reload to get back to your analysis. Your saved sales data is safe.</p>
            <button className="button button-primary" onClick={() => window.location.reload()}>
              Reload workspace
            </button>
          </div>
        </div>
      );
    return this.props.children;
  }
}
