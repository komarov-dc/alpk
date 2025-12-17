/**
 * Centralized Error Handling System
 * Provides unified error logging, reporting, and recovery mechanisms
 */

import { logger } from '@/utils/logger';


export interface ErrorContext {
  nodeId?: string;
  nodeType?: string;
  component?: string;
  operation?: string;
  userId?: string;
  projectId?: string;
  timestamp: string;
  userAgent?: string;
  sessionId?: string;
}

export interface ErrorReport {
  id: string;
  error: Error;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'execution' | 'ui' | 'api' | 'data' | 'network' | 'system';
  recoverable: boolean;
  retryCount?: number;
  resolved?: boolean;
  resolutionMethod?: string;
}

export type ErrorHandler = (error: Error, context?: Partial<ErrorContext>) => void;
export type ErrorReporter = (report: ErrorReport) => void;

class ErrorHandlerService {
  private errorReports: Map<string, ErrorReport> = new Map();
  private errorHandlers: Map<string, ErrorHandler> = new Map();
  private errorReporters: ErrorReporter[] = [];

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Determine error severity based on error type and context
   */
  private determineSeverity(error: Error, context: ErrorContext): ErrorReport['severity'] {
    if (context.nodeType === 'input' || context.nodeType === 'output') {
      return 'medium'; // I/O errors are important but not critical
    }
    
    if (context.nodeType === 'basicLLMChain' || context.nodeType === 'modelProvider') {
      return 'high'; // Core execution errors are high priority
    }
    
    if (context.component && context.component.includes('ErrorBoundary')) {
      return 'critical'; // Component crashes are critical
    }
    
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return 'high'; // Code errors are serious
    }
    
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return 'medium'; // Network errors are medium priority
    }
    
    return 'low'; // Default to low
  }

  /**
   * Categorize error based on error type and context
   */
  private categorizeError(error: Error, context: ErrorContext): ErrorReport['category'] {
    if (context.nodeId && context.operation) {
      return 'execution';
    }
    
    if (context.component) {
      return 'ui';
    }
    
    if (error.message.includes('fetch') || error.message.includes('API')) {
      return 'api';
    }
    
    if (error.message.includes('network') || error.message.includes('connection')) {
      return 'network';
    }
    
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return 'data';
    }
    
    return 'system';
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverable(error: Error, context: ErrorContext): boolean {
    // Network errors are usually recoverable
    if (this.categorizeError(error, context) === 'network') {
      return true;
    }
    
    // API errors might be recoverable
    if (this.categorizeError(error, context) === 'api') {
      return true;
    }
    
    // Execution errors might be recoverable with retry
    if (this.categorizeError(error, context) === 'execution') {
      return true;
    }
    
    // UI errors usually need component reset
    if (this.categorizeError(error, context) === 'ui') {
      return true;
    }
    
    // Data errors are usually not recoverable automatically
    if (this.categorizeError(error, context) === 'data') {
      return false;
    }
    
    return false;
  }

  /**
   * Handle error with full context and reporting
   */
  public handleError(
    error: Error, 
    contextOverride: Partial<ErrorContext> = {}
  ): ErrorReport {
    const context: ErrorContext = {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      sessionId: typeof window !== 'undefined' ? 
        sessionStorage.getItem('sessionId') || 'no-session' : 'server',
      ...contextOverride
    };

    const report: ErrorReport = {
      id: this.generateErrorId(),
      error,
      context,
      severity: this.determineSeverity(error, context),
      category: this.categorizeError(error, context),
      recoverable: this.isRecoverable(error, context),
      retryCount: 0,
      resolved: false
    };

    // Store the report
    this.errorReports.set(report.id, report);

    // Log the error
    this.logError(report);

    // Notify error handlers
    const handlerKey = `${context.nodeType || context.component || 'general'}`;
    const handler = this.errorHandlers.get(handlerKey) || this.errorHandlers.get('default');
    if (handler) {
      handler(error, context);
    }

    // Notify error reporters
    this.errorReporters.forEach(reporter => reporter(report));

    return report;
  }

  /**
   * Log error with appropriate level
   */
  private logError(report: ErrorReport): void {
    const logData = {
      id: report.id,
      message: report.error.message,
      context: JSON.stringify(report.context),
      severity: report.severity,
      category: report.category,
      stack: report.error.stack
    };

    switch (report.severity) {
      case 'critical':
        logger.error('🚨 CRITICAL ERROR:', report.error);
        logger.info('Details:', JSON.stringify(logData));
        break;
      case 'high':
        logger.error('❌ HIGH PRIORITY ERROR:', report.error);
        logger.info('Details:', JSON.stringify(logData));
        break;
      case 'medium':
        logger.warn('⚠️ MEDIUM PRIORITY ERROR:', report.error.message);
        logger.info('Details:', JSON.stringify(logData));
        break;
      case 'low':
        logger.info('ℹ️ LOW PRIORITY ERROR:', report.error.message);
        logger.info('Details:', JSON.stringify(logData));
        break;
    }
  }

  /**
   * Register error handler for specific contexts
   */
  public registerHandler(key: string, handler: ErrorHandler): void {
    this.errorHandlers.set(key, handler);
  }

  /**
   * Register error reporter (for external services, analytics, etc.)
   */
  public registerReporter(reporter: ErrorReporter): void {
    this.errorReporters.push(reporter);
  }

  /**
   * Attempt automatic recovery for recoverable errors
   */
  public async attemptRecovery(reportId: string): Promise<boolean> {
    const report = this.errorReports.get(reportId);
    if (!report || !report.recoverable) {
      return false;
    }

    report.retryCount = (report.retryCount || 0) + 1;
    
    // Don't retry more than 3 times
    if (report.retryCount > 3) {
      return false;
    }

    try {
      switch (report.category) {
        case 'network':
        case 'api':
          // For network/API errors, wait and retry
          await new Promise(resolve => setTimeout(resolve, 1000 * (report.retryCount || 1)));
          return true;
          
        case 'execution':
          // For execution errors, we can't auto-retry as it requires user context
          return false;
          
        case 'ui':
          // UI errors usually need component reset, handled by error boundaries
          return true;
          
        default:
          return false;
      }
    } catch (recoveryError) {
      logger.error('Recovery attempt failed:', recoveryError as Error);
      return false;
    }
  }

  /**
   * Get error statistics
   */
  public getErrorStats(): {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    resolved: number;
    recent: ErrorReport[];
  } {
    const reports = Array.from(this.errorReports.values());
    const recent = reports
      .filter(r => Date.now() - new Date(r.context.timestamp).getTime() < 5 * 60 * 1000) // Last 5 minutes
      .sort((a, b) => new Date(b.context.timestamp).getTime() - new Date(a.context.timestamp).getTime())
      .slice(0, 10);

    return {
      total: reports.length,
      bySeverity: reports.reduce((acc, r) => {
        acc[r.severity] = (acc[r.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byCategory: reports.reduce((acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      resolved: reports.filter(r => r.resolved).length,
      recent
    };
  }

  /**
   * Clear old error reports (keep last 100)
   */
  public cleanupOldReports(): void {
    const reports = Array.from(this.errorReports.entries());
    if (reports.length > 100) {
      // Sort by timestamp, keep most recent 100
      const sorted = reports.sort((a, b) => 
        new Date(b[1].context.timestamp).getTime() - new Date(a[1].context.timestamp).getTime()
      );
      
      // Clear map and re-add recent reports
      this.errorReports.clear();
      sorted.slice(0, 100).forEach(([id, report]) => {
        this.errorReports.set(id, report);
      });
    }
  }
}

// Singleton instance
export const errorHandler = new ErrorHandlerService();

// Helper functions for common error scenarios

/**
 * Handle node execution error
 */
export const handleNodeExecutionError = (
  error: Error,
  nodeId: string,
  nodeType: string,
  operation: string = 'execute'
): ErrorReport => {
  return errorHandler.handleError(error, {
    nodeId,
    nodeType,
    operation,
    component: 'NodeExecutor'
  });
};

/**
 * Handle component render error
 */
export const handleComponentError = (
  error: Error,
  component: string,
  context?: Partial<ErrorContext>
): ErrorReport => {
  return errorHandler.handleError(error, {
    component,
    operation: 'render',
    ...context
  });
};

/**
 * Handle API call error
 */
export const handleApiError = (
  error: Error,
  endpoint: string,
  method: string = 'POST'
): ErrorReport => {
  return errorHandler.handleError(error, {
    component: 'ApiClient',
    operation: `${method} ${endpoint}`
  });
};

/**
 * React hook for error reporting
 */
export const useErrorReporting = () => {
  return {
    reportError: (error: Error, context?: Partial<ErrorContext>) => {
      return errorHandler.handleError(error, context);
    },
    getStats: () => errorHandler.getErrorStats(),
    attemptRecovery: (reportId: string) => errorHandler.attemptRecovery(reportId)
  };
};

// Initialize default handlers
errorHandler.registerHandler('default', (error: Error, context?: Partial<ErrorContext>) => {
  // Default handler just logs - specific handlers can override
  logger.warn('Unhandled error type:', { error: error.message, context });
});

// Auto-cleanup old reports every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    errorHandler.cleanupOldReports();
  }, 5 * 60 * 1000);
}
