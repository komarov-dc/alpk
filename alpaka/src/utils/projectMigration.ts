/**
 * Project Migration System
 * Handles migration of legacy project formats to current schema
 */

import { Node, Edge } from '@xyflow/react';
import { ExecutionResult } from '@/types';
import { logger } from '@/utils/logger';
import { z } from 'zod';

// ============================================
// Version Detection & Schema Definitions
// ============================================

/**
 * Project version enumeration
 * Each version represents a significant schema change
 */
export enum ProjectVersion {
  V0_LEGACY = '0.0.0', // Original format without versioning
  V1_BASIC = '1.0.0',  // Added execution results
  V2_VARIABLES = '2.0.0', // Structured global variables
  V3_CURRENT = '3.0.0' // Current version with full type safety
}

/**
 * Base project structure that all versions share
 */
interface BaseProjectData {
  name: string;
  description?: string;
  nodes?: Node[];
  edges?: Edge[];
}

/**
 * Legacy V0 format (original unversioned format)
 */
interface ProjectDataV0 extends BaseProjectData {
  globalVariables?: Record<string, string>; // Simple string values
  // No execution results
  // No version field
}

/**
 * V1 format - Added execution results
 */
interface ProjectDataV1 extends BaseProjectData {
  version: '1.0.0';
  globalVariables?: Record<string, string>; // Still simple strings
  executionResults?: Record<string, ExecutionResult>;
}

/**
 * V2 format - Structured global variables
 */
interface ProjectDataV2 extends BaseProjectData {
  version: '2.0.0';
  globalVariables?: Record<string, {
    value: string;
    description?: string;
  }>;
  executionResults?: Record<string, ExecutionResult>;
}

/**
 * V3 format - Current format with full structure
 */
export interface ProjectDataV3 extends BaseProjectData {
  version: '3.0.0';
  globalVariables?: Record<string, {
    name: string;
    value: string;
    type?: string;
    description?: string;
    folder?: string;
  }>;
  executionResults?: Record<string, ExecutionResult>;
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    lastMigration?: string;
  };
}

/**
 * Union type for all project formats
 */
type AnyProjectData = ProjectDataV0 | ProjectDataV1 | ProjectDataV2 | ProjectDataV3;

// ============================================
// Version Detection
// ============================================

/**
 * Detects the version of a project data object
 */
export function detectProjectVersion(data: unknown): ProjectVersion {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid project data: not an object');
  }

  const obj = data as Record<string, unknown>;

  // Check for explicit version field
  if ('version' in obj && typeof obj.version === 'string') {
    switch (obj.version) {
      case '1.0.0':
        return ProjectVersion.V1_BASIC;
      case '2.0.0':
        return ProjectVersion.V2_VARIABLES;
      case '3.0.0':
        return ProjectVersion.V3_CURRENT;
      default:
        logger.warn(`Unknown project version: ${obj.version}, treating as legacy`);
        return ProjectVersion.V0_LEGACY;
    }
  }

  // No version field means legacy V0
  return ProjectVersion.V0_LEGACY;
}

/**
 * Validates that required fields exist in project data
 */
function validateBaseStructure(data: unknown): BaseProjectData {
  const baseSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    nodes: z.array(z.unknown()).optional(),
    edges: z.array(z.unknown()).optional()
  });

  const result = baseSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid project structure: ${result.error.message}`);
  }

  return result.data as BaseProjectData;
}

// ============================================
// Migration Functions
// ============================================

/**
 * Migrates V0 (legacy) to V1
 */
function migrateV0toV1(data: ProjectDataV0): ProjectDataV1 {
  logger.info('Migrating project from V0 (legacy) to V1');
  
  return {
    ...data,
    version: '1.0.0',
    executionResults: {} // Add empty execution results
  };
}

/**
 * Migrates V1 to V2
 */
function migrateV1toV2(data: ProjectDataV1): ProjectDataV2 {
  logger.info('Migrating project from V1 to V2');
  
  // Convert simple string variables to structured format
  const structuredVariables: Record<string, { value: string; description?: string }> = {};
  
  if (data.globalVariables) {
    Object.entries(data.globalVariables).forEach(([key, value]) => {
      structuredVariables[key] = {
        value: typeof value === 'string' ? value : String(value),
        description: 'Migrated from V1'
      };
    });
  }
  
  return {
    ...data,
    version: '2.0.0',
    globalVariables: structuredVariables
  };
}

/**
 * Migrates V2 to V3 (current)
 */
function migrateV2toV3(data: ProjectDataV2): ProjectDataV3 {
  logger.info('Migrating project from V2 to V3 (current)');
  
  // Add full structure to variables
  const fullyStructuredVariables: Record<string, {
    name: string;
    value: string;
    type?: string;
    description?: string;
    folder?: string;
  }> = {};
  
  if (data.globalVariables) {
    Object.entries(data.globalVariables).forEach(([key, varData]) => {
      fullyStructuredVariables[key] = {
        name: key,
        value: varData.value,
        type: detectVariableType(varData.value),
        description: varData.description || 'Migrated from V2',
        folder: undefined // No folder structure in V2
      };
    });
  }
  
  return {
    ...data,
    version: '3.0.0',
    globalVariables: fullyStructuredVariables,
    metadata: {
      lastMigration: new Date().toISOString()
    }
  };
}

/**
 * Detects the type of a variable value
 */
function detectVariableType(value: string): string {
  // Try to parse as JSON
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return 'array';
    if (typeof parsed === 'object') return 'json';
    if (typeof parsed === 'boolean') return 'boolean';
    if (typeof parsed === 'number') return 'number';
  } catch {
    // Not valid JSON, treat as string
  }
  
  // Check if it looks like a number
  if (/^\d+(\.\d+)?$/.test(value)) return 'number';
  
  // Check if it's a boolean string
  if (value === 'true' || value === 'false') return 'boolean';
  
  return 'string';
}

// ============================================
// Main Migration Function
// ============================================

/**
 * Migrates project data to the current version
 * Performs progressive migrations through all versions
 */
export function migrateProject(data: unknown): ProjectDataV3 {
  try {
    // First validate base structure
    validateBaseStructure(data);
    
    // Detect current version
    const version = detectProjectVersion(data);
    
    logger.info(`Detected project version: ${version}`);
    
    // If already current, just return with type assertion
    if (version === ProjectVersion.V3_CURRENT) {
      return data as ProjectDataV3;
    }
    
    // Progressive migration
    let migrationData: AnyProjectData = data as AnyProjectData;
    
    // V0 -> V1
    if (version === ProjectVersion.V0_LEGACY) {
      migrationData = migrateV0toV1(migrationData as ProjectDataV0);
      // Now it's V1, migrate to V2
      migrationData = migrateV1toV2(migrationData as ProjectDataV1);
      // Now it's V2, migrate to V3
      migrationData = migrateV2toV3(migrationData as ProjectDataV2);
    } else if (version === ProjectVersion.V1_BASIC) {
      // V1 -> V2
      migrationData = migrateV1toV2(migrationData as ProjectDataV1);
      // V2 -> V3
      migrationData = migrateV2toV3(migrationData as ProjectDataV2);
    } else if (version === ProjectVersion.V2_VARIABLES) {
      // V2 -> V3
      migrationData = migrateV2toV3(migrationData as ProjectDataV2);
    }
    
    logger.info('Project migration completed successfully');
    return migrationData as ProjectDataV3;
    
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to migrate project:', err);
    throw new ProjectMigrationError(`Migration failed: ${err.message}`, data);
  }
}

// ============================================
// Error Recovery & Repair
// ============================================

/**
 * Attempts to repair corrupted project data
 */
export function repairProjectData(data: unknown): ProjectDataV3 | null {
  try {
    logger.info('Attempting to repair corrupted project data');
    
    if (!data || typeof data !== 'object') {
      logger.error('Cannot repair: data is not an object');
      return null;
    }
    
    const obj = data as Record<string, unknown>;
    
    // Create a repaired structure with defaults
    const repaired: ProjectDataV3 = {
      version: '3.0.0',
      name: obj.name as string || 'Recovered Project',
      description: obj.description as string || 'Project recovered from corrupted data',
      nodes: [],
      edges: [],
      globalVariables: {},
      executionResults: {},
      metadata: {
        lastMigration: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }
    };
    
    // Try to salvage nodes
    if (Array.isArray(obj.nodes)) {
      repaired.nodes = obj.nodes.filter(node => {
        try {
          return node && typeof node === 'object' && 'id' in node;
        } catch {
          return false;
        }
      }) as Node[];
      logger.info(`Recovered ${repaired.nodes.length} nodes`);
    }
    
    // Try to salvage edges
    if (Array.isArray(obj.edges)) {
      repaired.edges = obj.edges.filter(edge => {
        try {
          return edge && typeof edge === 'object' && 
                 'id' in edge && 'source' in edge && 'target' in edge;
        } catch {
          return false;
        }
      }) as Edge[];
      logger.info(`Recovered ${repaired.edges.length} edges`);
    }
    
    // Try to salvage variables
    if (obj.globalVariables && typeof obj.globalVariables === 'object') {
      const vars = obj.globalVariables as Record<string, unknown>;
      Object.entries(vars).forEach(([key, value]) => {
        try {
          if (typeof value === 'string') {
            repaired.globalVariables![key] = {
              name: key,
              value: value,
              type: 'string',
              description: 'Recovered variable'
            };
          } else if (value && typeof value === 'object' && 'value' in value) {
            const varObj = value as Record<string, unknown>;
            repaired.globalVariables![key] = {
              name: key,
              value: String(varObj.value || ''),
              type: varObj.type as string || 'string',
              description: varObj.description as string || 'Recovered variable'
            };
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          logger.warn(`Failed to recover variable ${key}:`, error);
        }
      });
      logger.info(`Recovered ${Object.keys(repaired.globalVariables!).length} variables`);
    }
    
    return repaired;
    
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to repair project data:', err);
    return null;
  }
}

/**
 * Validates that a project has been successfully migrated to current version
 */
export function validateMigratedProject(data: ProjectDataV3): boolean {
  try {
    // Check version
    if (data.version !== '3.0.0') {
      logger.error(`Invalid version after migration: ${data.version}`);
      return false;
    }
    
    // Check required fields
    if (!data.name || typeof data.name !== 'string') {
      logger.error('Invalid or missing project name');
      return false;
    }
    
    // Check arrays
    if (!Array.isArray(data.nodes)) {
      logger.error('Nodes is not an array');
      return false;
    }
    
    if (!Array.isArray(data.edges)) {
      logger.error('Edges is not an array');
      return false;
    }
    
    // Check variables structure
    if (data.globalVariables) {
      for (const [key, variable] of Object.entries(data.globalVariables)) {
        if (!variable.name || !variable.value) {
          logger.error(`Invalid variable structure for ${key}`);
          return false;
        }
      }
    }
    
    return true;
    
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Validation error:', err);
    return false;
  }
}

// ============================================
// Custom Error Class
// ============================================

export class ProjectMigrationError extends Error {
  public originalData: unknown;
  
  constructor(message: string, originalData: unknown) {
    super(message);
    this.name = 'ProjectMigrationError';
    this.originalData = originalData;
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      originalData: this.originalData
    };
  }
}

// ============================================
// Export Migration Utilities
// ============================================

export const projectMigration = {
  detectVersion: detectProjectVersion,
  migrate: migrateProject,
  repair: repairProjectData,
  validate: validateMigratedProject,
  currentVersion: ProjectVersion.V3_CURRENT
};