/**
 * Feature Flags Configuration
 * 
 * Centralized configuration for feature toggles.
 * This allows us to safely introduce new features and gradually migrate
 * to new implementations without breaking existing functionality.
 */

export interface FeatureFlags {
  // Execution engine features
  execution: {
    // Enable execution queue for all node executions
    useExecutionQueue: boolean;
    
    // Enable parallel execution for workflows
    enableParallelExecution: boolean;
    
    // Maximum number of parallel workers
    maxParallelWorkers: number;
  };
  
  // Store consolidation
  stores: {
    // Use the consolidated store (merged Flow + Project stores)
    useConsolidatedStore: boolean;
  };
  
  // Performance features
  performance: {
    // Enable metrics collection
    enableMetrics: boolean;
    
    // Enable execution caching
    enableCaching: boolean;
    
    // Enable lazy loading of node components
    enableLazyLoading: boolean;
    
    // Use optimized variable interpolation (memory efficient)
    useFastInterpolation: boolean;
  };
  
  // Debug features
  debug: {
    // Enable debug logging
    enableDebugLogging: boolean;
    
    // Enable execution tracing
    enableExecutionTracing: boolean;
    
    // Enable performance profiling
    enableProfiling: boolean;
  };
}

// Default feature flags configuration
const defaultFlags: FeatureFlags = {
  execution: {
    useExecutionQueue: true, // Queue system integrated
    enableParallelExecution: true, // ENABLED - parallel execution
    maxParallelWorkers: 3 // Default 3, adjustable via UI (1-10)
  },
  
  stores: {
    useConsolidatedStore: false // Will enable after consolidation
  },
  
  performance: {
    enableMetrics: true,
    enableCaching: false,
    enableLazyLoading: false,
    useFastInterpolation: true
  },
  
  debug: {
    enableDebugLogging: false,
    enableExecutionTracing: false,
    enableProfiling: false
  }
};

// Load feature flags from environment or localStorage
function loadFeatureFlags(): FeatureFlags {
  const flags = { ...defaultFlags };
  
  // Check environment variables (for build-time configuration)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.REACT_APP_ENABLE_PARALLEL_EXECUTION === 'true') {
      flags.execution.enableParallelExecution = true;
    }
    if (process.env.REACT_APP_DEBUG === 'true') {
      flags.debug.enableDebugLogging = true;
      flags.debug.enableExecutionTracing = true;
    }
  }
  
  // Check localStorage for runtime overrides
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const storedFlags = localStorage.getItem('alpaka_feature_flags');
      if (storedFlags) {
        const parsed = JSON.parse(storedFlags);
        // Deep merge with defaults
        Object.keys(parsed).forEach(category => {
          if (flags[category as keyof FeatureFlags]) {
            Object.assign(
              flags[category as keyof FeatureFlags],
              parsed[category]
            );
          }
        });
      }
    } catch {
      // Silent fail
    }
  }
  
  return flags;
}

// Singleton instance
let featureFlagsInstance: FeatureFlags | null = null;

/**
 * Get the current feature flags configuration
 */
export function getFeatureFlags(): FeatureFlags {
  if (!featureFlagsInstance) {
    featureFlagsInstance = loadFeatureFlags();
  }
  return featureFlagsInstance;
}

/**
 * Update feature flags at runtime
 */
export function updateFeatureFlags(updates: Partial<FeatureFlags>): void {
  const current = getFeatureFlags();
  
  // Deep merge updates
  Object.keys(updates).forEach(category => {
    const categoryKey = category as keyof FeatureFlags;
    if (current[categoryKey]) {
      Object.assign(current[categoryKey], updates[categoryKey]);
    }
  });
  
  // Save to localStorage for persistence
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem('alpaka_feature_flags', JSON.stringify(current));
  } catch {
      // Silent fail
    }
  }
  
  // Update singleton
  featureFlagsInstance = current;
}

/**
 * Reset feature flags to defaults
 */
export function resetFeatureFlags(): void {
  featureFlagsInstance = { ...defaultFlags };
  
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('alpaka_feature_flags');
  }
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(path: string): boolean {
  const flags = getFeatureFlags();
  const parts = path.split('.');
  
  let current: unknown = flags;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return false;
    }
  }
  
  return current === true;
}

// Export convenience checkers
export const FeatureChecks = {
  isExecutionQueueEnabled: () => isFeatureEnabled('execution.useExecutionQueue'),
  isParallelExecutionEnabled: () => isFeatureEnabled('execution.enableParallelExecution'),
  isConsolidatedStoreEnabled: () => isFeatureEnabled('stores.useConsolidatedStore'),
  isMetricsEnabled: () => isFeatureEnabled('performance.enableMetrics'),
  isFastInterpolationEnabled: () => isFeatureEnabled('performance.useFastInterpolation'),
  isDebugLoggingEnabled: () => isFeatureEnabled('debug.enableDebugLogging')
};

// Initialize on module load
getFeatureFlags();
