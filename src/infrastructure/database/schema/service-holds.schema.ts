import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { contracts } from "./contracts.schema";
import { userTable } from "./user.schema";
import { serviceTypeEnum } from "./services.schema";

// Hold status enum
export const holdStatusEnum = pgEnum("hold_status", [
  "active", // Active (not expired)
  "released", // Released (service completed or cancelled)
  "expired", // Expired (TTL timeout)
]);

/**
 * Service holds table
 * TTL mechanism to prevent over-booking
 *
 * Key features:
 * - TTL mechanism: Holds expire after HOLD_TTL_MINUTES (default: 15 minutes)
 * - Triggers automatically sync held_quantity in contract_service_entitlements (v2.16.5)
 * - Batch cleanup task runs periodically (HOLD_CLEANUP_CRON)
 * - Only active holds count toward held_quantity
 *
 * Use cases:
 * - Booking flow: Create hold → Create booking → Release hold (on completion/cancellation)
 * - If booking fails: Hold will auto-expire after TTL
 * - Manual release: Update hold status to released
 *
 * Design decision (v2.16.5 C-NEW-2): Trigger-based sync
 * - held_quantity in contract_service_entitlements is automatically maintained by trigger
 * - No need for manual balance recalculation in application layer
 * - Ensures data consistency even under high concurrency
 */
export const serviceHolds = pgTable("service_holds", {
  // Primary key
  id: uuid("id").defaultRandom().primaryKey(),

  // Contract and student reference
  contractId: uuid("contract_id")
    .notNull()
    .references(() => contracts.id),
  studentId: varchar("student_id", { length: 32 })
    .notNull()
    .references(() => userTable.id),

  // Service type and quantity
  serviceType: serviceTypeEnum("service_type").notNull(),
  quantity: integer("quantity").notNull().default(1), // Default: hold 1 unit

  // Status management
  status: holdStatusEnum("status").notNull().default("active"),

  // TTL expiration time
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // Default: createdAt + 15 minutes

  // Related business record
  relatedBookingId: uuid("related_booking_id"), // Related booking ID (sessions/classes, etc.)

  // Release information
  releasedAt: timestamp("released_at", { withTimezone: true }),
  releaseReason: varchar("release_reason", { length: 100 }), // 'completed' | 'cancelled' | 'expired'

  // Audit fields
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: varchar("created_by", { length: 32 })
    .notNull()
    .references(() => userTable.id),

  // Timestamp field
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// Type inference
export type ServiceHold = typeof serviceHolds.$inferSelect;
export type InsertServiceHold = typeof serviceHolds.$inferInsert;

/*
 * Indexes (to be created in contract_indexes.sql):
 * - CREATE INDEX idx_service_holds_contract ON service_holds(contract_id);
 * - CREATE INDEX idx_service_holds_student ON service_holds(student_id);
 * - CREATE INDEX idx_service_holds_service_type ON service_holds(service_type);
 * - CREATE INDEX idx_service_holds_status ON service_holds(status);
 * - CREATE INDEX idx_service_holds_expires_at ON service_holds(expires_at);
 * - CREATE INDEX idx_service_holds_active_expires ON service_holds(status, expires_at)
 *   WHERE status = 'active'; (Partial index for cleanup task)
 *
 * Triggers (to be created in contract_triggers.sql - v2.16.5 C-NEW-2):
 * - After INSERT/UPDATE on service_holds → sync_held_quantity()
 *   Updates contract_service_entitlements.held_quantity and available_quantity
 *   Only counts holds with status = 'active'
 *
 * Trigger function: sync_held_quantity()
 * ```sql
 * CREATE OR REPLACE FUNCTION sync_held_quantity()
 * RETURNS TRIGGER AS $$
 * BEGIN
 *   -- Scenario 1: Create new hold (INSERT with status = 'active')
 *   IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
 *     UPDATE contract_service_entitlements
 *     SET
 *       held_quantity = held_quantity + NEW.quantity,
 *       available_quantity = available_quantity - NEW.quantity,
 *       updated_at = NOW()
 *     WHERE contract_id = NEW.contract_id
 *       AND service_type = NEW.service_type;
 *
 *     IF NOT FOUND THEN
 *       RAISE EXCEPTION 'Entitlement not found for contract_id=%, service_type=%',
 *         NEW.contract_id, NEW.service_type;
 *     END IF;
 *
 *     RETURN NEW;
 *   END IF;
 *
 *   -- Scenario 2: Release hold (UPDATE from 'active' to other status)
 *   IF TG_OP = 'UPDATE'
 *      AND OLD.status = 'active'
 *      AND NEW.status != 'active' THEN
 *     UPDATE contract_service_entitlements
 *     SET
 *       held_quantity = held_quantity - OLD.quantity,
 *       available_quantity = available_quantity + OLD.quantity,
 *       updated_at = NOW()
 *     WHERE contract_id = OLD.contract_id
 *       AND service_type = OLD.service_type;
 *
 *     RETURN NEW;
 *   END IF;
 *
 *   RETURN NEW;
 * END;
 * $$ LANGUAGE plpgsql;
 * ```
 *
 * Business rules:
 * 1. **TTL default 15 minutes**: expiresAt = createdAt + 15 minutes (configurable via HOLD_TTL_MINUTES)
 * 2. **Auto cleanup**: Scheduled task cleans up expired holds
 * 3. **Status flow**: active → released/expired
 * 4. **Available balance calculation**: total_quantity - consumed_quantity - held_quantity
 * 5. **Trigger-based sync**: Application layer only needs to operate on service_holds table,
 *    held_quantity will be automatically synced by trigger
 *
 * Batch cleanup task (hold-cleanup.task.ts):
 * - Runs every HOLD_CLEANUP_CRON (default: every 5 minutes)
 * - Updates: SET status = 'expired', release_reason = 'expired', released_at = NOW()
 *   WHERE status = 'active' AND expires_at < NOW()
 * - Trigger automatically updates held_quantity after status change
 *
 * Environment variables:
 * - HOLD_TTL_MINUTES: Hold expiration time in minutes (default: 15)
 * - HOLD_CLEANUP_CRON: Cleanup task schedule (default: every 5 minutes)
 *
 * Application layer code simplification (no manual sync needed - v2.16.7):
 * ```typescript
 * // Create hold (trigger automatically syncs held_quantity)
 * // Supports optional transaction parameter
 * async createHold(dto: CreateHoldDto, tx?: DrizzleTransaction): Promise<ServiceHold> {
 *   const executor = tx ?? db;
 *
 *   return await executor.insert(serviceHolds).values({
 *     contractId: dto.contractId,
 *     studentId: dto.studentId,
 *     serviceType: dto.serviceType,
 *     quantity: dto.quantity ?? 1,
 *     expiresAt: new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000),
 *     createdBy: dto.createdBy,
 *   }).returning();
 * }
 *
 * // Release hold (trigger automatically syncs held_quantity)
 * async releaseHold(id: string, reason: string): Promise<ServiceHold> {
 *   return await db.update(serviceHolds)
 *     .set({
 *       status: 'released',
 *       releaseReason: reason,
 *       releasedAt: new Date(),
 *     })
 *     .where(eq(serviceHolds.id, id))
 *     .returning();
 * }
 * ```
 */
