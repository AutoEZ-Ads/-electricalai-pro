import React from 'react';
import { Box, Heading, Text, Button, Card } from '@vibe/core';
import { AlertTriangle, Refresh } from '@vibe/core/icons';

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
        <Box padding="large" display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <Card>
            <Box padding="large" textAlign="center" maxWidth="500px">
              <AlertTriangle size="large" color="negative" marginBottom="medium" />
              
              <Heading size="large" marginBottom="small">
                Oops! Something went wrong
              </Heading>
              
              <Text color="secondary" marginBottom="large">
                {this.props.errorMessage || 
                  'We encountered an unexpected error. Our team has been notified and is working on a fix.'
                }
              </Text>

              {/* Error Details (only show in development) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <Box marginBottom="large">
                  <details style={{ textAlign: 'left', marginTop: '1rem' }}>
                    <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                      <Text size="small" weight="bold">Error Details (Development Only)</Text>
                    </summary>
                    <Box 
                      backgroundColor="var(--color-surface-negative-subtle)"
                      padding="small"
                      borderRadius="4px"
                      marginTop="small"
                    >
                      <Text size="small" family="monospace">
                        <strong>Error:</strong> {this.state.error.message}
                      </Text>
                      <br />
                      <Text size="small" family="monospace">
                        <strong>Stack:</strong>
                      </Text>
                      <pre style={{ 
                        fontSize: '11px', 
                        overflow: 'auto', 
                        maxHeight: '200px',
                        marginTop: '4px',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {this.state.error.stack}
                      </pre>
                    </Box>
                  </details>
                </Box>
              )}

              {/* Error ID for support */}
              {this.state.errorId && (
                <Text size="small" color="secondary" marginBottom="large">
                  Error ID: {this.state.errorId}
                </Text>
              )}

              {/* Action Buttons */}
              <Box display="flex" gap="small" justifyContent="center">
                <Button
                  leftIcon={Refresh}
                  onClick={this.handleRetry}
                  kind="secondary"
                >
                  Try Again
                </Button>
                
                <Button
                  onClick={this.handleReload}
                >
                  Reload Page
                </Button>
              </Box>

              {/* Support Info */}
              <Box marginTop="large">
                <Text size="small" color="secondary">
                  Need help? Contact{' '}
                  <a 
                    href="mailto:support@electricalai.pro" 
                    style={{ color: 'var(--primary-color)' }}
                  >
                    support@electricalai.pro
                  </a>
                  {this.state.errorId && ` and include Error ID: ${this.state.errorId}`}
                </Text>
              </Box>
            </Box>
          </Card>
        </Box>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;