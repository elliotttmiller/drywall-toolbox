/**
 * frontend/src/components/ApiErrorBoundary.jsx
 *
 * React class component error boundary for API-related rendering errors.
 * Renders a user-friendly fallback UI.
 * Logs to console.error in development only.
 */

import { Component } from 'react';

class ApiErrorBoundary extends Component {
  constructor( props ) {
    super( props );
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch( error, info ) {
    if ( process.env.NODE_ENV !== 'production' ) {
      console.error( '[ApiErrorBoundary]', error, info );
    }
  }

  handleReload = () => {
    this.setState( { hasError: false } );
  }

  render() {
    if ( this.state.hasError ) {
      return (
        <div
          role="alert"
          style={ {
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        '2rem',
            textAlign:      'center',
            fontFamily:     'Inter, system-ui, sans-serif',
            color:          '#e2e8f0',
            background:     '#1e293b',
            borderRadius:   '0.5rem',
            margin:         '1rem',
          } }
        >
          <h2 style={ { fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' } }>
            Something went wrong loading this section
          </h2>
          <p style={ { color: '#94a3b8', marginBottom: '1.25rem', maxWidth: 380 } }>
            We couldn&rsquo;t load this content right now. Please try again.
          </p>
          <button
            onClick={ this.handleReload }
            style={ {
              padding:      '0.5rem 1.25rem',
              background:   '#3b82f6',
              color:        '#fff',
              border:       'none',
              borderRadius: '0.375rem',
              cursor:       'pointer',
              fontSize:     '0.9rem',
              fontWeight:   600,
            } }
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ApiErrorBoundary;
