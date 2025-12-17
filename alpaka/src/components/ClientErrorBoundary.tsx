'use client';

import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import { useErrorReporting } from '@/hooks/useErrorReporting';

interface ClientErrorBoundaryProps {
  children: React.ReactNode;
  context?: string;
}

/**
 * Client-side error boundary with error reporting integration
 */
export default function ClientErrorBoundary({ children, context }: ClientErrorBoundaryProps) {
  const { reportError } = useErrorReporting();

  return (
    <ErrorBoundary 
      onError={(error) => {
        reportError(error, context || 'Client Component');
      }}
    >
      {children}
    </ErrorBoundary>
  );
}