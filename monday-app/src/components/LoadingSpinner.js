import React from 'react';

/**
 * LoadingSpinner component for showing loading states
 */
const LoadingSpinner = ({ 
  size = 'medium', 
  text = 'Loading...', 
  centered = true, 
  className = '',
  ...props 
}) => {
  const spinnerSize = size === 'large' ? '48px' : size === 'small' ? '20px' : '32px';
  
  const content = (
    <div className={className} {...props}>
      <div 
        style={{
          width: spinnerSize,
          height: spinnerSize,
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #0073ea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
      />
      {text && (
        <p style={{ 
          fontSize: '14px', 
          color: '#666', 
          marginTop: '10px',
          margin: '10px 0 0 0' 
        }}>
          {text}
        </p>
      )}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );

  if (centered) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '200px'
      }}>
        {content}
      </div>
    );
  }

  return content;
};

export default LoadingSpinner;