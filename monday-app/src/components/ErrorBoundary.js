import React from 'react';

/**
 * ErrorBoundary component for catching and displaying React errors
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In a real application, you would log this to an error reporting service
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService = (error, errorInfo) => {
    // This would integrate with error reporting services like Sentry, LogRocket, etc.
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    console.log('Error logged:', errorData);
    
    // Example: Send to error reporting service
    // errorReportingService.captureException(error, { extra: errorData });
  };

  handleRetry = () => {
    // Clear error state to retry rendering
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  handleReload = () => {
    // Reload the entire page
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom error UI
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo, this.handleRetry);
      }

      // Default error UI
      return (
        <div style={{ 
          padding: '40px', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '400px' 
        }}>
          <div style={{ 
            background: 'white', 
            padding: '40px', 
            borderRadius: '8px', 
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center', 
            maxWidth: '500px' 
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
            
            <h1 style={{ fontSize: '24px', marginBottom: '10px', color: '#333' }}>
              Oops! Something went wrong
            </h1>
            
            <p style={{ color: '#666', marginBottom: '30px' }}>
              {this.props.errorMessage || 
                'We encountered an unexpected error. Our team has been notified and is working on a fix.'
              }
            </p>

            {/* Error Details (only show in development) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div style={{ marginBottom: '30px' }}>
                <details style={{ textAlign: 'left', marginTop: '1rem' }}>
                  <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '12px' }}>Error Details (Development Only)</strong>
                  </summary>
                  <div style={{ 
                    backgroundColor: '#f8f9fa',
                    padding: '15px',
                    borderRadius: '4px',
                    marginTop: '10px',
                    border: '1px solid #e9ecef'
                  }}>
                    <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                      <strong>Error:</strong> {this.state.error.message}
                    </div>
                    <br />
                    <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                      <strong>Stack:</strong>
                    </div>
                    <pre style={{ 
                      fontSize: '11px', 
                      overflow: 'auto', 
                      maxHeight: '200px',
                      marginTop: '4px',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {this.state.error.stack}
                    </pre>
                  </div>
                </details>
              </div>
            )}

            {/* Error ID for support */}
            {this.state.errorId && (
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '30px' }}>
                Error ID: {this.state.errorId}
              </p>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  backgroundColor: '#f8f9fa',
                  color: '#333',
                  padding: '10px 20px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                🔄 Try Again
              </button>
              
              <button
                onClick={this.handleReload}
                style={{
                  backgroundColor: '#0073ea',
                  color: 'white',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Reload Page
              </button>
            </div>

            {/* Support Info */}
            <div style={{ marginTop: '30px' }}>
              <p style={{ fontSize: '12px', color: '#666' }}>
                Need help? Contact{' '}
                <a 
                  href="mailto:support@electricalai.pro" 
                  style={{ color: '#0073ea' }}
                >
                  support@electricalai.pro
                </a>
                {this.state.errorId && ` and include Error ID: ${this.state.errorId}`}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;