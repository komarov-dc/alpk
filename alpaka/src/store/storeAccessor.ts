/**
 * Store accessor module to avoid circular dependencies
 * This provides a way for execution modules to access the store
 * without directly importing it, breaking the circular dependency chain.
 */

import type { FlowStore } from './useFlowStore';

let storeGetter: (() => FlowStore) | null = null;

/**
 * Register the store getter function
 * This should be called once when the store is initialized
 */
export function registerStoreGetter(getter: () => FlowStore) {
  storeGetter = getter;
}

/**
 * Get the current store state
 * Used by queueManager for backward compatibility
 * @internal
 */
export function getFlowStore(): FlowStore {
  if (!storeGetter) {
    throw new Error('Store getter not registered. Make sure to call registerStoreGetter when initializing the store.');
  }
  return storeGetter();
}
