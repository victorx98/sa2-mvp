/**
 * Contract Domain Constants
 * Configuration values and business rules
 */

// ============================================================================
// Contract Number Generation
// ============================================================================

export const CONTRACT_NUMBER_PREFIX = "CONTRACT";
export const CONTRACT_NUMBER_MAX_PER_MONTH = 99999;

// ============================================================================
// Service Hold Configuration
// ============================================================================

// Hold TTL mechanism removed in v2.16.9. Manual release only.
// export const HOLD_TTL_MINUTES = parseInt(
//   process.env.HOLD_TTL_MINUTES || "15",
//   10,
// );

// Automatic cleanup removed in v2.16.9. Manual release only.
// export const HOLD_CLEANUP_CRON = process.env.HOLD_CLEANUP_CRON || "*/5 * * * *";

// ============================================================================
// Event Publisher Configuration
// ============================================================================

// Event publisher polling interval in milliseconds (default: 30 seconds)
export const EVENT_PUBLISHER_POLL_INTERVAL_MS = parseInt(
  process.env.EVENT_PUBLISHER_POLL_INTERVAL_MS || "30000",
  10,
);

// Maximum retry count for failed events (default: 5)
export const EVENT_PUBLISHER_MAX_RETRIES = parseInt(
  process.env.EVENT_PUBLISHER_MAX_RETRIES || "5",
  10,
);

// Batch size for event publishing (default: 100)
export const EVENT_PUBLISHER_BATCH_SIZE = parseInt(
  process.env.EVENT_PUBLISHER_BATCH_SIZE || "100",
  10,
);

// Event retention period in days (default: 30)
export const EVENT_RETENTION_DAYS = parseInt(
  process.env.EVENT_RETENTION_DAYS || "30",
  10,
);

// ============================================================================
// Archive Configuration
// ============================================================================

// Default archive period in days (default: 90)
export const ARCHIVE_AFTER_DAYS = parseInt(
  process.env.ARCHIVE_AFTER_DAYS || "90",
  10,
);

// Whether to delete from main table after archiving (default: false)
export const DELETE_AFTER_ARCHIVE = process.env.DELETE_AFTER_ARCHIVE === "true";

// Maximum date range for archive queries in days (default: 365 - 1 year)
export const ARCHIVE_MAX_DATE_RANGE_DAYS = 365;

// Archive task cron schedule (default: daily at 2 AM)
export const ARCHIVE_TASK_CRON = process.env.ARCHIVE_TASK_CRON || "0 2 * * *";

// ============================================================================
// Service Consumption Priority
// ============================================================================

// Priority order for service consumption (Decision #6)
// Higher value = higher priority
export const CONSUMPTION_PRIORITY = {
  product: 4, // Highest priority
  addon: 3,
  promotion: 2,
  compensation: 1, // Lowest priority
} as const;

// ============================================================================
// Concurrent Control
// ============================================================================

// Lock timeout in milliseconds for optimistic locking (default: 5 seconds)
export const LOCK_TIMEOUT_MS = parseInt(
  process.env.LOCK_TIMEOUT_MS || "5000",
  10,
);

// Maximum retry attempts for concurrent operations (default: 3)
export const MAX_RETRY_ATTEMPTS = parseInt(
  process.env.MAX_RETRY_ATTEMPTS || "3",
  10,
);

// ============================================================================
// Validation Rules
// ============================================================================

// Minimum contract amount (in USD dollars, default: $1.00)
export const MIN_CONTRACT_AMOUNT_DOLLARS = 1.0;

// Maximum contract amount (in USD dollars, default: $1,000,000.00)
export const MAX_CONTRACT_AMOUNT_DOLLARS = 1000000.0;

// Minimum service quantity
export const MIN_SERVICE_QUANTITY = 1;

// Maximum service quantity per entitlement
export const MAX_SERVICE_QUANTITY = 99999;

// ============================================================================
// Pagination Defaults
// ============================================================================

// Default page size for queries
export const DEFAULT_PAGE_SIZE = 20;

// Maximum page size for queries
export const MAX_PAGE_SIZE = 100;

// ============================================================================
// Advisory Lock Keys (for PostgreSQL pg_advisory_lock)
// ============================================================================

// Base key for contract number generation locks
// Format: YYYYMM (e.g., 202511 for November 2025)
export const CONTRACT_NUMBER_LOCK_KEY_BASE = 100000000;

// ============================================================================
// Query Optimization
// ============================================================================

// Whether to include archived ledgers by default
export const INCLUDE_ARCHIVE_DEFAULT = false;

// Default lookback period for ledger queries (in days)
export const DEFAULT_LEDGER_LOOKBACK_DAYS = 90;

// ============================================================================
// Type Guards and Type Exports
// ============================================================================

export type ConsumptionPriority = keyof typeof CONSUMPTION_PRIORITY;

/**
 * Get consumption priority value for a source
 */
export function getConsumptionPriority(source: ConsumptionPriority): number {
  return CONSUMPTION_PRIORITY[source];
}

/**
 * Sort entitlements by consumption priority (highest first)
 */
export function sortByConsumptionPriority<
  T extends { source: ConsumptionPriority },
>(entitlements: T[]): T[] {
  return entitlements.sort(
    (a, b) =>
      getConsumptionPriority(b.source) - getConsumptionPriority(a.source),
  );
}
