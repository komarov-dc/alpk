/**
 * Performance configuration for large projects
 * Optimized for 800+ nodes (MGIMO project scale)
 */

export const PERFORMANCE_CONFIG = {
  // Thresholds for enabling optimizations
  LARGE_PROJECT_NODE_COUNT: 100,    // When to consider project "large"
  HUGE_PROJECT_NODE_COUNT: 200,     // When to enable aggressive optimizations
  MEGA_PROJECT_NODE_COUNT: 500,     // When to enable extreme optimizations
  ULTRA_PROJECT_NODE_COUNT: 800,    // Maximum performance mode
  
  // Rendering optimizations
  DISABLE_ANIMATIONS_ABOVE: 150,    // Disable animations for better performance
  SIMPLIFY_EDGES_ABOVE: 100,        // Use straight edges instead of smooth
  HIDE_MINIMAP_ABOVE: 200,          // Hide minimap to save rendering
  DISABLE_EDGE_LABELS_ABOVE: 300,   // Hide edge labels
  USE_FAST_EDGES_ABOVE: 500,        // Use simplest edge rendering
  
  // Debounce timings (ms)
  NODE_UPDATE_DEBOUNCE: 100,        // Delay before updating node data
  AUTOSAVE_DEBOUNCE: 10000,         // Delay before auto-saving (10 seconds for huge projects)
  
  // Viewport settings
  RENDER_BUFFER: 50,                // Reduced buffer for 800+ nodes
  
  // Batch operations
  BATCH_SIZE: 5,                    // Smaller batches for smoother updates
  BATCH_DELAY: 100,                 // Increased delay between batches
  
  // Zoom levels for LOD (Level of Detail)
  LOD_FULL_DETAIL: 0.5,             // Show full detail above 50% zoom
  LOD_SIMPLIFIED: 0.25,             // Show simplified nodes 25-50% zoom
  LOD_MINIMAL: 0.1,                 // Show minimal nodes below 25% zoom
};

/**
 * Get performance settings based on node count
 */
export function getPerformanceSettings(nodeCount: number) {
  const isUltraProject = nodeCount >= PERFORMANCE_CONFIG.ULTRA_PROJECT_NODE_COUNT;
  const isMegaProject = nodeCount >= PERFORMANCE_CONFIG.MEGA_PROJECT_NODE_COUNT;
  
  return {
    // Animations - completely disabled for 500+ nodes
    enableAnimations: nodeCount < PERFORMANCE_CONFIG.DISABLE_ANIMATIONS_ABOVE,
    
    // Edge rendering - progressive simplification
    edgeType: 
      nodeCount > PERFORMANCE_CONFIG.USE_FAST_EDGES_ABOVE ? 'straight' :
      nodeCount > PERFORMANCE_CONFIG.SIMPLIFY_EDGES_ABOVE ? 'straight' : 
      'smoothstep',
    animatedEdges: nodeCount < 50,
    showEdgeLabels: nodeCount < PERFORMANCE_CONFIG.DISABLE_EDGE_LABELS_ABOVE,
    
    // UI elements
    showMinimap: nodeCount < PERFORMANCE_CONFIG.HIDE_MINIMAP_ABOVE,
    showDebugInfo: nodeCount < 100,
    showZoomIndicator: true, // Always show zoom for navigation
    
    // Interaction
    snapToGrid: false, // Always disabled for performance
    multiSelectionKeyCode: isUltraProject ? null : 'Shift', // Disable multi-select for ultra projects
    
    // Viewport
    renderBuffer: isUltraProject ? 25 : isMegaProject ? 50 : PERFORMANCE_CONFIG.RENDER_BUFFER,
    
    // Auto-save
    autosaveDebounce: isUltraProject ? 15000 : isMegaProject ? 10000 : PERFORMANCE_CONFIG.AUTOSAVE_DEBOUNCE,
    
    // Is this a large project?
    isLargeProject: nodeCount >= PERFORMANCE_CONFIG.LARGE_PROJECT_NODE_COUNT,
    isHugeProject: nodeCount >= PERFORMANCE_CONFIG.HUGE_PROJECT_NODE_COUNT,
    isMegaProject: isMegaProject,
    isUltraProject: isUltraProject,
  };
}

/**
 * Hook to get current performance mode
 */
export function usePerformanceMode(nodeCount: number) {
  if (nodeCount >= PERFORMANCE_CONFIG.ULTRA_PROJECT_NODE_COUNT) {
    return 'ultra'; // Absolute maximum optimizations for 800+ nodes
  } else if (nodeCount >= PERFORMANCE_CONFIG.MEGA_PROJECT_NODE_COUNT) {
    return 'extreme'; // Maximum optimizations for 500+ nodes
  } else if (nodeCount >= PERFORMANCE_CONFIG.HUGE_PROJECT_NODE_COUNT) {
    return 'aggressive'; // Aggressive optimizations for 200+ nodes
  } else if (nodeCount >= PERFORMANCE_CONFIG.LARGE_PROJECT_NODE_COUNT) {
    return 'optimized'; // Balanced optimizations for 100+ nodes
  }
  return 'normal'; // Full features
}

/**
 * Get LOD (Level of Detail) settings based on zoom
 */
export function getLODSettings(zoom: number, nodeCount: number) {
  // Only apply LOD for large projects
  if (nodeCount < PERFORMANCE_CONFIG.HUGE_PROJECT_NODE_COUNT) {
    return { level: 'full', showLabels: true, showMessages: true, showControls: true };
  }
  
  if (zoom >= PERFORMANCE_CONFIG.LOD_FULL_DETAIL) {
    return { level: 'full', showLabels: true, showMessages: true, showControls: true };
  } else if (zoom >= PERFORMANCE_CONFIG.LOD_SIMPLIFIED) {
    return { level: 'simplified', showLabels: true, showMessages: false, showControls: false };
  } else if (zoom >= PERFORMANCE_CONFIG.LOD_MINIMAL) {
    return { level: 'minimal', showLabels: false, showMessages: false, showControls: false };
  }
  
  // Ultra minimal for very zoomed out
  return { level: 'ultra-minimal', showLabels: false, showMessages: false, showControls: false };
}
