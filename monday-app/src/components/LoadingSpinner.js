import React from 'react';
import { Loader, Box, Text } from '@vibe/core';

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
  const content = (
    <Box className={className} {...props}>
      <Loader size={size} />
      {text && (
        <Text size="small" color="secondary" marginTop="small">
          {text}
        </Text>
      )}
    </Box>
  );

  if (centered) {
    return (
      <Box 
        display="flex" 
        flexDirection="column" 
        alignItems="center" 
        justifyContent="center"
        minHeight="200px"
      >
        {content}
      </Box>
    );
  }

  return content;
};

export default LoadingSpinner;