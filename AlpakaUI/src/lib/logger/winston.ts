import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = '\n' + JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

// Create transports
const transports: winston.transport[] = [];

// Console transport (always enabled in development)
if (process.env.NODE_ENV !== 'production' || process.env.LOG_TO_CONSOLE === 'true') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.LOG_LEVEL || 'debug'
    })
  );
}

// File transports
// Error logs
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat
  })
);

// Combined logs
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat
  })
);

// Application logs (info and above, excluding http)
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'info',
    maxSize: '20m',
    maxFiles: '7d',
    format: winston.format.combine(
      winston.format((info) => info.level !== 'http' ? info : false)(),
      logFormat
    )
  })
);

// Create logger instance
const logger = winston.createLogger({
  levels,
  level: process.env.LOG_LEVEL || 'info',
  transports,
  exitOnError: false
});

// Export logger methods with context support
export class Logger {
  private context: string;
  private metadata: Record<string, unknown>;

  constructor(context: string, metadata: Record<string, unknown> = {}) {
    this.context = context;
    this.metadata = metadata;
  }

  private log(level: string, message: string, meta?: Record<string, unknown>) {
    logger.log(level, message, {
      context: this.context,
      ...this.metadata,
      ...meta
    });
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>) {
    this.log('error', message, {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      ...meta
    });
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log('info', message, meta);
  }

  http(message: string, meta?: Record<string, unknown>) {
    this.log('http', message, meta);
  }

  verbose(message: string, meta?: Record<string, unknown>) {
    this.log('verbose', message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.log('debug', message, meta);
  }

  // Performance logging
  startTimer(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.info(`Timer: ${label}`, { duration, label });
    };
  }

  // Audit logging
  audit(action: string, userId: string, details?: Record<string, unknown>) {
    this.info(`Audit: ${action}`, {
      audit: true,
      action,
      userId,
      ...details
    });
  }

  // Security logging
  security(event: string, details?: Record<string, unknown>) {
    this.warn(`Security: ${event}`, {
      security: true,
      event,
      ...details
    });
  }
}

// Create a default logger instance
export const defaultLogger = new Logger('default');

// Export factory function
export function createLogger(context: string, metadata?: Record<string, unknown>): Logger {
  return new Logger(context, metadata);
}

// Stream for morgan HTTP logging
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  }
};

export default logger;