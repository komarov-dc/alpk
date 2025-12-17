
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    name: string;
  };
}

class ClientLogger {
  private context: string;
  private logs: LogEntry[] = [];
  private maxLogs = 100;
  private enabled: boolean;
  private minLevel: LogLevel;

  constructor(context: string) {
    this.context = context;
    this.enabled = process.env.NEXT_PUBLIC_DEBUG === 'true';
    this.minLevel = (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled && process.env.NODE_ENV === 'production') {
      return false;
    }

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.minLevel);
    const logLevelIndex = levels.indexOf(level);

    return logLevelIndex >= currentLevelIndex;
  }

  private formatMessage(entry: LogEntry): string {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    return `[${time}] [${entry.level.toUpperCase()}] [${entry.context}] ${entry.message}`;
  }

  private addLog(level: LogLevel, message: string, data?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      data
    };

    // Store in memory
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Log to console if enabled
    if (this.shouldLog(level)) {
      const formattedMessage = this.formatMessage(entry);
      
      const consoleMethod = {
        debug: console.debug,
        info: console.info,
        warn: console.warn,
        error: console.error
      }[level];
      
      consoleMethod(formattedMessage, data || '');
    }

    // Send critical errors to server
    if (level === 'error' && process.env.NODE_ENV === 'production') {
      this.sendToServer(entry);
    }
  }

  private async sendToServer(entry: LogEntry) {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(entry)
      });
    } catch {
      // Silently fail to avoid infinite loop
    }
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.addLog('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>) {
    this.addLog('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.addLog('warn', message, data);
  }

  error(message: string, error?: Error | Record<string, unknown>, data?: Record<string, unknown>) {
    const errorData = error instanceof Error ? {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      ...(data && typeof data === 'object' ? data : { data })
    } : { error, ...(data && typeof data === 'object' ? data : { data }) };

    this.addLog('error', message, errorData);
  }

  // Performance measurement
  startTimer(label: string): () => void {
    const start = performance.now();
    this.debug(`Timer started: ${label}`);
    
    return () => {
      const duration = performance.now() - start;
      this.info(`Timer: ${label}`, { duration: `${duration.toFixed(2)}ms`, label });
    };
  }

  // Get stored logs
  getLogs(level?: LogLevel): LogEntry[] {
    if (!level) return this.logs;
    return this.logs.filter(log => log.level === level);
  }

  // Clear stored logs
  clearLogs() {
    this.logs = [];
  }

  // Export logs as JSON
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Track user actions
  trackAction(action: string, details?: Record<string, unknown>) {
    this.info(`User action: ${action}`, { 
      action, 
      ...(details || {})
    });
  }

  // Track performance metrics
  trackMetric(name: string, value: number, unit: string = 'ms') {
    this.info(`Metric: ${name}`, { metric: name, value, unit });
  }
}

// Factory function to create logger instances
export function createClientLogger(context: string): ClientLogger {
  return new ClientLogger(context);
}

// Default logger for general use
export const clientLogger = new ClientLogger('app');

// Specialized loggers
export const apiLogger = new ClientLogger('api');
export const authLogger = new ClientLogger('auth');
export const uiLogger = new ClientLogger('ui');
export const performanceLogger = new ClientLogger('performance');

// Global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    clientLogger.error('Unhandled error', event.error || {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    clientLogger.error('Unhandled promise rejection', {
      reason: event.reason,
      promise: event.promise
    });
  });
}

export default clientLogger;