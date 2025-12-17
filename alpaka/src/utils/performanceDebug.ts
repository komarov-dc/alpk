/**
 * Performance debugging utilities
 * Enable in browser console: window.enablePerfDebug()
 */

import { logger } from '@/utils/logger';

// Extend Window interface for performance debugging
interface WindowWithPerfDebug extends Window {
  DEBUG_PERF?: boolean;
  enablePerfDebug?: () => void;
  disablePerfDebug?: () => void;
}

export const enablePerformanceDebug = () => {
  if (typeof window !== 'undefined') {
    const windowWithDebug = window as WindowWithPerfDebug;
    windowWithDebug.DEBUG_PERF = true;
    logger.info('🚀 Performance debugging enabled');
    logger.info('Node lookups will now be logged');
  }
};

export const disablePerformanceDebug = () => {
  if (typeof window !== 'undefined') {
    const windowWithDebug = window as WindowWithPerfDebug;
    windowWithDebug.DEBUG_PERF = false;
    logger.info('Performance debugging disabled');
  }
};

// Auto-attach to window for easy console access
if (typeof window !== 'undefined') {
  const windowWithDebug = window as WindowWithPerfDebug;
  windowWithDebug.enablePerfDebug = enablePerformanceDebug;
  windowWithDebug.disablePerfDebug = disablePerformanceDebug;
}
