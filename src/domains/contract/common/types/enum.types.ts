/**
 * Enum Types for Contract Domain
 * These types are derived from database schema enums
 */

import { serviceTypeEnum } from "@infrastructure/database/schema/services.schema";

/**
 * Service type - directly imported from database schema
 * This ensures type consistency with the database enum
 */
export { serviceTypeEnum };
export type ServiceType = (typeof serviceTypeEnum.enumValues)[number];

/**
 * Contract status enum values from contracts.schema.ts
 */
export type ContractStatusEnum =
  | "signed"
  | "active"
  | "suspended"
  | "completed"
  | "terminated";

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
  | "contract_signed"
  | "manual_adjustment"
  | "auto_expiration";

/**
 * Entitlement source enum values from contract-service-entitlements.schema.ts
 */
export type EntitlementSourceEnum =
  | "product"
  | "addon"
  | "promotion"
  | "compensation";
