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
          <div className="unavailable error-state" role="alert">
            <h1>Something went wrong</h1>
            <p>Reload the page to continue. Your saved sales data is safe.</p>
            <button className="button button-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    return this.props.children;
  }
}
