/**
 * Application-wide constants
 * All magic numbers and configuration values in one place
 */

// ============================================================================
// TIME CONSTANTS (in milliseconds)
// ============================================================================

export const TIME = {
  /** 1 second in milliseconds */
  SECOND: 1000,
  /** 1 minute in milliseconds */
  MINUTE: 60 * 1000,
  /** 1 hour in milliseconds */
  HOUR: 60 * 60 * 1000,
  /** 1 day in milliseconds */
  DAY: 24 * 60 * 60 * 1000,
} as const;

// ============================================================================
// RATE LIMITING
// ============================================================================

export const RATE_LIMIT = {
  /** Cleanup interval for rate limit cache (1 minute) */
  CLEANUP_INTERVAL: TIME.MINUTE,

  /** Default rate limit window (1 minute) */
  DEFAULT_WINDOW: TIME.MINUTE,
  /** Default max requests per window */
  DEFAULT_MAX_REQUESTS: 100,

  /** Auth endpoints rate limit window (15 minutes) */
  AUTH_WINDOW: 15 * TIME.MINUTE,
  /** Max auth attempts per window */
  AUTH_MAX_REQUESTS: 5,

  /** Strict rate limit for sensitive operations */
  STRICT_MAX_REQUESTS: 10,
} as const;

// ============================================================================
// SESSION & AUTHENTICATION
// ============================================================================

export const SESSION = {
  /** Auto-logout timeout (1 hour of inactivity) */
  AUTO_LOGOUT_TIMEOUT: TIME.HOUR,

  /** Cookie expiry for "Remember Me" (30 days) */
  REMEMBER_ME_EXPIRY: 30 * TIME.DAY,

  /** Cookie expiry for session-only login (7 days) */
  SESSION_COOKIE_EXPIRY: 7 * TIME.DAY,
} as const;

// ============================================================================
// PDF GENERATION
// ============================================================================

export const PDF = {
  /** Page margins */
  MARGIN: {
    LEFT: 20,
    RIGHT: 20,
    TOP: 20,
    BOTTOM: 20,
  },

  /** Page dimensions */
  PAGE: {
    WIDTH: 210, // A4 width in mm
    HEIGHT: 297, // A4 height in mm
    /** Usable width (PAGE_WIDTH - margins) */
    USABLE_WIDTH: 170,
    /** Page break threshold */
    BREAK_THRESHOLD: 270,
  },

  /** Font sizes */
  FONT_SIZE: {
    TITLE: 16,
    HEADING: 14,
    SUBHEADING: 12,
    BODY: 10,
    SMALL: 8,
  },

  /** Line heights */
  LINE_HEIGHT: {
    DEFAULT: 7,
    COMPACT: 5,
    SPACIOUS: 10,
  },

  /** Colors (RGB 0-255 range) */
  COLOR: {
    PRIMARY: [0.2, 0.4, 0.8] as const,
    TEXT: [0, 0, 0] as const,
    GRAY: [0.5, 0.5, 0.5] as const,
    LIGHT_GRAY: [0.8, 0.8, 0.8] as const,
    WHITE: [255, 255, 255] as const,
    BLACK: [0, 0, 0] as const,
    GRAY_128: [128, 128, 128] as const,
    // Report type colors
    REPORT_FULL: [66, 135, 245] as const,
    REPORT_ADAPTED: [52, 211, 153] as const,
    REPORT_SCORE_TABLE: [168, 85, 247] as const,
  },
} as const;

// ============================================================================
// QUESTIONNAIRE
// ============================================================================

export const QUESTIONNAIRE = {
  /** Total number of questions per session */
  TOTAL_QUESTIONS: 5,

  /** Minimum answer length (characters) */
  MIN_ANSWER_LENGTH: 10,

  /** Maximum answer length (characters) */
  MAX_ANSWER_LENGTH: 2000,
} as const;

// ============================================================================
// API
// ============================================================================

export const API = {
  /** Default API timeout (30 seconds) */
  DEFAULT_TIMEOUT: 30 * TIME.SECOND,

  /** Long-running operation timeout (2 minutes) */
  LONG_TIMEOUT: 2 * TIME.MINUTE,

  /** Retry attempts for failed requests */
  MAX_RETRIES: 3,

  /** Delay between retries (exponential backoff base) */
  RETRY_DELAY_BASE: 1000,
} as const;

// ============================================================================
// VALIDATION
// ============================================================================

export const VALIDATION = {
  /** Password minimum length */
  PASSWORD_MIN_LENGTH: 8,

  /** Password maximum length */
  PASSWORD_MAX_LENGTH: 128,

  /** Username min length */
  USERNAME_MIN_LENGTH: 2,

  /** Username max length */
  USERNAME_MAX_LENGTH: 50,
} as const;
