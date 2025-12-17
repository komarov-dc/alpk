/**
 * Centralized logger for Alpaka
 * Replaces console.log throughout the application
 * Only logs in development mode to prevent data leaks in production
 */

import type { LoggableValue, LoggableError, TableData } from '@/types/logger';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  isDevelopment: boolean;
  isDebugEnabled: boolean;
  logLevel: LogLevel;
}

class Logger {
  private config: LoggerConfig;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    this.config = {
      isDevelopment: process.env.NODE_ENV !== 'production',
      isDebugEnabled: process.env.NEXT_PUBLIC_DEBUG === 'true',
      logLevel: (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) || 'info',
    };
  }

  private shouldLog(level: LogLevel): boolean {
    // Allow standalone mode to log in production
    if (process.env.ALPAKA_STANDALONE_MODE === 'true') {
      return this.levels[level] >= this.levels[this.config.logLevel];
    }

    if (!this.config.isDevelopment) {
      // In production, only log errors
      return level === 'error';
    }
    return this.levels[level] >= this.levels[this.config.logLevel];
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  debug(message: string, data?: LoggableValue): void {
    if (this.shouldLog('debug')) {
      const formatted = this.formatMessage('debug', message);
      console.log(formatted, data !== undefined ? data : '');
    }
  }

  info(message: string, data?: LoggableValue): void {
    if (this.shouldLog('info')) {
      const formatted = this.formatMessage('info', message);
      console.log(formatted, data !== undefined ? data : '');
    }
  }

  warn(message: string, data?: LoggableValue): void {
    if (this.shouldLog('warn')) {
      const formatted = this.formatMessage('warn', message);
      console.warn(formatted, data !== undefined ? data : '');
    }
  }

  error(message: string, error?: LoggableError): void {
    if (this.shouldLog('error')) {
      const formatted = this.formatMessage('error', message);
      console.error(formatted);
      
      if (error instanceof Error) {
        console.error('Stack trace:', error.stack);
      } else if (typeof error === 'string') {
        console.error('Error message:', error);
      } else if (error && typeof error === 'object' && 'message' in error) {
        console.error('Error details:', error);
      } else if (error !== undefined) {
        console.error('Error data:', error);
      }
    }
  }

  // Utility method to conditionally log only in development
  dev(message: string, data?: LoggableValue): void {
    if (this.config.isDevelopment) {
      // Use console.log directly to bypass log level filtering
      const formatted = `[DEV] ${message}`;
      console.log(formatted, data !== undefined ? data : '');
    }
  }
  
  // Alias for console.log compatibility
  log(message: string, data?: LoggableValue): void {
    this.info(message, data);
  }
  
  // Group logging methods
  group(label: string): void {
    if (this.config.isDevelopment || this.config.isDebugEnabled) {
      console.group(label);
    }
  }
  
  groupEnd(): void {
    if (this.config.isDevelopment || this.config.isDebugEnabled) {
      console.groupEnd();
    }
  }
  
  // Table logging for debugging
  table(data: TableData): void {
    if (this.config.isDevelopment || this.config.isDebugEnabled) {
      console.table(data);
    }
  }
  
  // Conditional logging
  if(condition: boolean) {
    return {
      log: (message: string, data?: LoggableValue) => {
        if (condition) this.log(message, data);
      },
      info: (message: string, data?: LoggableValue) => {
        if (condition) this.info(message, data);
      },
      warn: (message: string, data?: LoggableValue) => {
        if (condition) this.warn(message, data);
      },
      error: (message: string, error?: LoggableError) => {
        if (condition) this.error(message, error);
      },
      debug: (message: string, data?: LoggableValue) => {
        if (condition) this.debug(message, data);
      }
    };
  }

  // Create a child logger with a specific context
  child(context: string): ChildLogger {
    return new ChildLogger(this, context);
  }
}

class ChildLogger {
  constructor(private parent: Logger, private context: string) {}

  private prefixMessage(message: string): string {
    return `[${this.context}] ${message}`;
  }

  debug(message: string, data?: LoggableValue): void {
    this.parent.debug(this.prefixMessage(message), data);
  }

  info(message: string, data?: LoggableValue): void {
    this.parent.info(this.prefixMessage(message), data);
  }

  warn(message: string, data?: LoggableValue): void {
    this.parent.warn(this.prefixMessage(message), data);
  }

  error(message: string, error?: LoggableError): void {
    this.parent.error(this.prefixMessage(message), error);
  }

  dev(message: string, data?: LoggableValue): void {
    this.parent.dev(this.prefixMessage(message), data);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for testing purposes
export { Logger, ChildLogger };
