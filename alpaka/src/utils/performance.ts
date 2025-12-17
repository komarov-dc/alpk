/**
 * Performance optimization utilities for React components
 */

import { useRef, useCallback, useMemo, useEffect, useState, DependencyList } from 'react';
import { logger } from '@/utils/logger';
import { CONFIG } from '@/config/constants';

/**
 * Custom hook for deep comparison of dependencies
 */
export function useDeepCompareMemo<T>(factory: () => T, deps: DependencyList): T {
  const ref = useRef<DependencyList | undefined>(undefined);
  
  if (!isDeepEqual(deps, ref.current)) {
    ref.current = deps;
  }
  
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Dependencies tracked via ref for deep comparison
  return useMemo(factory, ref.current || []);
}

/**
 * Custom hook for deep comparison effect
 */
export function useDeepCompareEffect(effect: () => void, deps: DependencyList): void {
  const ref = useRef<DependencyList | undefined>(undefined);
  
  if (!isDeepEqual(deps, ref.current)) {
    ref.current = deps;
  }
  
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Dependencies tracked via ref for deep comparison
  useEffect(effect, ref.current || []);
}

/**
 * Custom hook for debounced callback
 */
export function useDebouncedCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  delay: number,
  deps: DependencyList = []
): T {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const callbackRef = useRef(callback);
  
  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional spread for flexibility
    [delay, ...deps]
  );
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return debouncedCallback as T;
}

/**
 * Custom hook for throttled callback
 */
export function useThrottledCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  delay: number,
  deps: DependencyList = []
): T {
  const lastRunRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const callbackRef = useRef(callback);
  
  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastRun = now - lastRunRef.current;
      
      if (timeSinceLastRun >= delay) {
        lastRunRef.current = now;
        callbackRef.current(...args);
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(() => {
          lastRunRef.current = Date.now();
          callbackRef.current(...args);
        }, delay - timeSinceLastRun);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional spread for flexibility
    [delay, ...deps]
  );
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return throttledCallback as T;
}

/**
 * Custom hook for lazy initial state
 */
export function useLazyInitialState<T>(initializer: () => T): T {
  const [state] = useState(() => initializer());
  return state;
}

/**
 * Custom hook to track render count (for debugging)
 */
export function useRenderCount(componentName: string): number {
  const renderCount = useRef(0);
  
  useEffect(() => {
    renderCount.current += 1;
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`${componentName} rendered ${renderCount.current} times`);
    }
  });
  
  return renderCount.current;
}

/**
 * Custom hook for previous value tracking
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
}

/**
 * Custom hook for intersection observer
 */
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
): IntersectionObserverEntry | undefined {
  const [entry, setEntry] = useState<IntersectionObserverEntry>();
  
  useEffect(() => {
    if (!ref.current) return;
    
    const observer = new IntersectionObserver(([entry]) => {
      setEntry(entry);
    }, options);
    
    observer.observe(ref.current);
    
    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Options object reference stability
  }, [ref, options.root, options.rootMargin, options.threshold]);
  
  return entry;
}

/**
 * Custom hook for virtual scrolling
 */
export function useVirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5
}: {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    
    return { startIndex, endIndex };
  }, [scrollTop, items.length, itemHeight, containerHeight, overscan]);
  
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [items, visibleRange]);
  
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.startIndex * itemHeight;
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll: (e: React.UIEvent<HTMLElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    }
  };
}

/**
 * Deep equality check for objects and arrays
 */
function isDeepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;
  
  if (obj1 == null || obj2 == null) return false;
  
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    return obj1 === obj2;
  }
  
  const keys1 = Object.keys(obj1 as Record<string, unknown>);
  const keys2 = Object.keys(obj2 as Record<string, unknown>);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!isDeepEqual((obj1 as Record<string, unknown>)[key], (obj2 as Record<string, unknown>)[key])) return false;
  }
  
  return true;
}

/**
 * Memoize function results with LRU cache
 */
export function memoize<T extends (...args: never[]) => unknown>(
  fn: T,
  getKey?: (...args: Parameters<T>) => string,
  maxSize = CONFIG.STORAGE.MAX_RECENT_PROJECTS * 10
): T {
  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>();
  
  return ((...args: Parameters<T>) => {
    const key = getKey ? getKey(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      const cached = cache.get(key)!;
      // Update timestamp for LRU
      cached.timestamp = Date.now();
      return cached.value;
    }
    
    const result = fn(...args);
    cache.set(key, { value: result as ReturnType<T>, timestamp: Date.now() });
    
    // Implement proper LRU cache eviction
    if (cache.size > maxSize) {
      let oldestKey: string | undefined;
      let oldestTime = Infinity;
      
      cache.forEach((value, key) => {
        if (value.timestamp < oldestTime) {
          oldestTime = value.timestamp;
          oldestKey = key;
        }
      });
      
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }
    
    return result;
  }) as T;
}

/**
 * Batch updates for better performance
 */
export function batchUpdates<T extends (...args: never[]) => void>(
  fn: T,
  delay: number = 0
): T {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingArgs: Parameters<T>[] = [];
  
  return ((...args: Parameters<T>) => {
    pendingArgs.push(args);
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      const argsCopy = [...pendingArgs];
      pendingArgs = [];
      timeoutId = null;
      
      argsCopy.forEach(args => fn(...args));
    }, delay);
  }) as T;
}

/**
 * RAF (Request Animation Frame) scheduler for smooth animations
 */
export function rafSchedule<T extends (...args: never[]) => unknown>(fn: T): T {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  
  const scheduled = (...args: Parameters<T>) => {
    lastArgs = args;
    
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (lastArgs) {
          fn(...lastArgs);
        }
        rafId = null;
      });
    }
  };
  
  return scheduled as T;
}
