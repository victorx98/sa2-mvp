import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  json,
  pgEnum,
} from "drizzle-orm/pg-core";
import { contracts } from "./contracts.schema";
import { userTable } from "./user.schema";
import { serviceTypeEnum } from "./services.schema";

// Ledger type enum
export const serviceLedgerTypeEnum = pgEnum("service_ledger_type", [
  "consumption", // Service consumption (quantity < 0)
  "refund", // Refund (quantity > 0)
  "adjustment", // Manual adjustment (quantity can be positive or negative)
  "initial", // Initialization (quantity > 0)
  "expiration", // Expiration deduction (quantity < 0)
]);

// Ledger source enum
export const serviceLedgerSourceEnum = pgEnum("service_ledger_source", [
  "booking_completed", // Booking completed
  "booking_cancelled", // Booking cancelled
  "contract_signed", // Contract signed
  "manual_adjustment", // Manual adjustment
  "auto_expiration", // Auto expiration
]);

/**
 * Service ledgers table (Append-only)
 * Tracks every service consumption and adjustment
 *
 * Key features:
 * - Append-only: Only INSERT allowed, no UPDATE/DELETE
 * - Immutable audit trail for service consumption
 * - balanceAfter snapshot for reconciliation
 * - Supports multiple ledger types (consumption, refund, adjustment, initial, expiration)
 * - Related to service holds and bookings
 *
 * Design principles:
 * - Single source of truth for service consumption history
 * - Adjustments are recorded as new entries (never modify existing records)
 * - Each ledger entry includes balanceAfter for point-in-time balance tracking
 */
export const serviceLedgers = pgTable("service_ledgers", {
  // Primary key
  id: uuid("id").defaultRandom().primaryKey(),

  // Contract and student reference
  contractId: uuid("contract_id")
    .notNull()
    .references(() => contracts.id),
  studentId: varchar("student_id", { length: 32 })
    .notNull()
    .references(() => userTable.id),

  // Service type
  serviceType: serviceTypeEnum("service_type").notNull(),

  // Quantity change (negative = consumption, positive = increase)
  quantity: integer("quantity").notNull(),

  // Ledger type and source
  type: serviceLedgerTypeEnum("type").notNull(),
  source: serviceLedgerSourceEnum("source").notNull(),

  // Balance snapshot after this operation (must be >= 0)
  balanceAfter: integer("balance_after").notNull(), // For reconciliation

  // Related business records
  relatedHoldId: uuid("related_hold_id"), // Related hold record
  relatedBookingId: uuid("related_booking_id"), // Related booking ID (sessions/classes, etc.)

  // Audit fields
  reason: text("reason"), // Required when type = 'adjustment'
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: varchar("created_by", { length: 32 })
    .notNull()
    .references(() => userTable.id),

  // Metadata
  metadata: json("metadata").$type<{
    originalBalance?: number; // Original balance before this operation
    operatorIp?: string; // Operator IP address
    approvedBy?: string; // Approver for manual adjustments
    [key: string]: any;
  }>(), // Additional information
});

// Type inference
export type ServiceLedger = typeof serviceLedgers.$inferSelect;
export type InsertServiceLedger = typeof serviceLedgers.$inferInsert;

/*
 * Indexes (to be created in contract_indexes.sql):
 * - CREATE INDEX idx_service_ledgers_contract ON service_ledgers(contract_id);
 * - CREATE INDEX idx_service_ledgers_student ON service_ledgers(student_id);
 * - CREATE INDEX idx_service_ledgers_service_type ON service_ledgers(service_type);
 * - CREATE INDEX idx_service_ledgers_created_at ON service_ledgers(created_at);
 * - CREATE INDEX idx_service_ledgers_source ON service_ledgers(source);
 * - CREATE INDEX idx_service_ledgers_contract_created ON service_ledgers(contract_id, created_at DESC);
 *   (Composite index for contract history queries)
 * - CREATE INDEX idx_service_ledgers_student_created ON service_ledgers(student_id, created_at DESC);
 *   (Composite index for student history queries)
 *
 * CHECK constraints (to be created in contract_constraints.sql):
 * - ALTER TABLE service_ledgers ADD CONSTRAINT chk_balance_after_non_negative
 *   CHECK (balance_after >= 0);
 *   (Ensures balance never goes negative)
 *
 * - ALTER TABLE service_ledgers ADD CONSTRAINT chk_adjustment_reason CHECK (
 *     (type != 'adjustment') OR (reason IS NOT NULL AND length(reason) > 0)
 *   );
 *   (Ensures reason is provided for manual adjustments)
 *
 * - ALTER TABLE service_ledgers ADD CONSTRAINT chk_consumption_quantity_negative
 *   CHECK (type != 'consumption' OR quantity < 0);
 *   (Consumption must have negative quantity)
 *
 * - ALTER TABLE service_ledgers ADD CONSTRAINT chk_refund_quantity_positive
 *   CHECK (type != 'refund' OR quantity > 0);
 *   (Refund must have positive quantity)
 *
 * - ALTER TABLE service_ledgers ADD CONSTRAINT chk_initial_quantity_positive
 *   CHECK (type != 'initial' OR quantity > 0);
 *   (Initial must have positive quantity)
 *
 * - ALTER TABLE service_ledgers ADD CONSTRAINT chk_expiration_quantity_negative
 *   CHECK (type != 'expiration' OR quantity < 0);
 *   (Expiration must have negative quantity)
 *
 * Business rules:
 * 1. **Append-only**: Application layer must NOT perform UPDATE/DELETE operations
 * 2. **Balance non-negative**: balanceAfter >= 0 (enforced by CHECK constraint)
 * 3. **Quantity constraints**:
 *    - type='consumption' → quantity < 0
 *    - type='refund' → quantity > 0
 *    - type='initial' → quantity > 0
 *    - type='expiration' → quantity < 0
 *    - type='adjustment' → quantity can be positive or negative
 * 4. **Required fields**: When type='adjustment', reason must be provided
 * 5. **Reconciliation**: balanceAfter provides point-in-time balance snapshot for auditing
 *
 * Important notes:
 * - This table is APPEND-ONLY: no UPDATE or DELETE operations allowed
 * - To "reverse" a ledger entry, create a new adjustment entry with opposite quantity
 * - balanceAfter is used for reconciliation and audit purposes
 * - Related holds and bookings can be traced via relatedHoldId and relatedBookingId
 */
