import { Component } from 'react';

/**
 * Top-level React error boundary.
 *
 * Catches any uncaught JavaScript errors thrown inside the component tree and
 * renders a user-friendly fallback instead of a blank white screen.  This
 * prevents production crashes from being completely invisible to the user.
 *
 * Usage: wrap the application root in <ErrorBoundary> inside main.jsx.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production webpack drops console calls, but this intentional error
    // log is preserved here so the error appears in HostGator's error log
    // if server-side logging is configured.  The guard prevents leaking info
    // in development where the React overlay is already shown.
    if (process.env.NODE_ENV === 'production') {
      // Structured log without leaking stack to browser console in prod.
      // Webpack's drop_console setting removes console.log/info — this is
      // console.error, which is preserved so monitoring tools can capture it.
      console.error('[ErrorBoundary] Unhandled render error:', error, info);
    }
  }

  handleReload = () => {
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            minHeight:      '100vh',
            textAlign:      'center',
            padding:        '2rem',
            fontFamily:     'Inter, system-ui, sans-serif',
            background:     '#0f172a',
            color:          '#e2e8f0',
          }}
        >
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem', maxWidth: 440 }}>
            An unexpected error occurred. Please reload the page — if the
            problem persists, contact support.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding:      '0.6rem 1.5rem',
              background:   '#3b82f6',
              color:        '#fff',
              border:       'none',
              borderRadius: '0.375rem',
              cursor:       'pointer',
              fontSize:     '0.95rem',
              fontWeight:   600,
            }}
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
