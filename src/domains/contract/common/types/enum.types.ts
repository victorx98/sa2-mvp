/**
 * Contract status enum values from contracts.schema.ts
 */
export type ContractStatusEnum =
  | "SIGNED"
  | "ACTIVE"
  | "SUSPENDED"
  | "COMPLETED"
  | "TERMINATED";

/**
 * Currency enum values from products.schema.ts
 */
export type CurrencyEnum = "USD" | "CNY" | "EUR" | "GBP" | "JPY";

/**
 * Hold status enum values from service-holds.schema.ts
 */
export type HoldStatusEnum = "active" | "released" | "expired";

/**
 * Ledger type enum values from service-ledgers.schema.ts
 */
export type LedgerTypeEnum =
  | "consumption"
  | "refund"
  | "adjustment"
  | "initial"
  | "expiration";

/**
 * Ledger source enum values from service-ledgers.schema.ts
 */
export type LedgerSourceEnum =
  | "booking_completed"
  | "booking_cancelled"
  | "manual_adjustment";

/**
 * Entitlement source enum values from contract-service-entitlements.schema.ts
 */
export type EntitlementSourceEnum =
  | "product"
  | "addon"
  | "promotion"
  | "compensation";
