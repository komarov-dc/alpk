'use client';

import { useCallback } from 'react';
import { logger } from '@/utils/logger';

interface ErrorReport {
  error: Error;
  context?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  userId?: string;
}

/**
 * Hook for centralized error reporting and logging
 */
export const useErrorReporting = () => {
  const reportError = useCallback((error: Error, context?: string) => {
    const report: ErrorReport = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } as Error,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      logger.group('🚨 Error Report');
      logger.error('Error:', error);
      logger.info('Context:', context || 'No context');
      logger.info('Full Report:', JSON.stringify(report));
      logger.groupEnd();
    }

    // TODO: Send to error reporting service in production
    // Examples: Sentry, LogRocket, Bugsnag, etc.
    // Example:
    // if (process.env.NODE_ENV === 'production') {
    //   Sentry.captureException(error, { extra: report });
    // }

    // Store in localStorage for debugging (keep last 10 errors)
    try {
      const storedErrors = JSON.parse(localStorage.getItem('alpaka_errors') || '[]');
      storedErrors.push(report);
      
      // Keep only last 10 errors
      if (storedErrors.length > 10) {
        storedErrors.shift();
      }
      
      localStorage.setItem('alpaka_errors', JSON.stringify(storedErrors));
    } catch (storageError) {
      logger.warn('Failed to store error in localStorage:', storageError instanceof Error ? storageError.message : String(storageError));
    }
  }, []);

  const getStoredErrors = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem('alpaka_errors') || '[]') as ErrorReport[];
    } catch {
      return [];
    }
  }, []);

  const clearStoredErrors = useCallback(() => {
    localStorage.removeItem('alpaka_errors');
  }, []);

  return {
    reportError,
    getStoredErrors,
    clearStoredErrors,
  };
};