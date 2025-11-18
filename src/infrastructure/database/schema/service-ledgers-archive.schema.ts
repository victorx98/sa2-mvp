import {
  pgTable,
  uuid,
  integer,
  timestamp,
  text,
  json,
  varchar,
} from "drizzle-orm/pg-core";
import {
  serviceLedgerTypeEnum,
  serviceLedgerSourceEnum,
} from "./service-ledgers.schema";
// import { serviceTypes } from "./service-types.schema";

/**
 * Service ledgers archive table [DEPRECATED]
 * Cold-hot data separation for historical ledger records
 *
 * Key features:
 * - Identical structure to service_ledgers table (except archivedAt field)
 * - Stores historical ledger records older than archiveAfterDays
 * - Optimized indexes for archive queries
 * - Supports UNION ALL queries for complete history
 *
 * Archive strategy (v2.16.4 Decision I5):
 * 1. **Default queries (fast)**: Only query service_ledgers table (recent data)
 * 2. **Complete history queries (includeArchive=true)**: Use UNION ALL to merge both tables
 * 3. **Date range filtering required**: Must provide date range to avoid full table scan
 * 4. **Composite indexes**: Optimize common query patterns
 *
 * Archive policies (configurable per contract/service_type):
 * - Global policy: Archive after 90 days (default)
 * - Contract-specific policy: Custom archive period per contract
 * - Service-type policy: Custom archive period per service type
 * - Priority: contract > service_type > global
 *
 * Design decision (v2.16.4 I5):
 * - Maintains same schema as service_ledgers for transparent UNION ALL queries
 * - Additional archivedAt timestamp tracks when record was archived
 * - Original ID preserved for referential integrity
 *
 * v2.17.0: DEPRECATED - Cold-hot data separation removed
 * @deprecated Since v2.17.0, cold-hot data separation has been removed. This table is renamed to service_ledgers_archive_deprecated.
 */
export const serviceLedgersArchive = pgTable(
  "service_ledgers_archive_deprecated",
  {
    // Primary key (preserves original ID)
    id: uuid("id").primaryKey(),

    // Contract and student reference (no FK - archived data)
    contractId: uuid("contract_id").notNull(),
    studentId: varchar("student_id", { length: 32 }).notNull(),

    // Service type
    serviceType: varchar("service_type", { length: 50 }).notNull(), // Reference to service_types.code (no FK in archive table)

    // Quantity change
    quantity: integer("quantity").notNull(),

    // Ledger type and source
    type: serviceLedgerTypeEnum("type").notNull(),
    source: serviceLedgerSourceEnum("source").notNull(),

    // Balance snapshot
    balanceAfter: integer("balance_after").notNull(),

    // Related business records
    relatedHoldId: uuid("related_hold_id"),
    relatedBookingId: uuid("related_booking_id"),

    // Audit fields
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    createdBy: varchar("created_by", { length: 32 }).notNull(),

    // Metadata
    metadata: json("metadata").$type<{
      originalBalance?: number;
      operatorIp?: string;
      approvedBy?: string;
      [key: string]: any;
    }>(),

    // Archive information
    archivedAt: timestamp("archived_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

// Type inference
export type ServiceLedgerArchive = typeof serviceLedgersArchive.$inferSelect;
export type InsertServiceLedgerArchive =
  typeof serviceLedgersArchive.$inferInsert;

/*
 * Indexes (to be created in contract_indexes.sql - optimized for archive queries):
 * - CREATE INDEX idx_service_ledgers_archive_contract ON service_ledgers_archive(contract_id);
 * - CREATE INDEX idx_service_ledgers_archive_student ON service_ledgers_archive(student_id);
 * - CREATE INDEX idx_service_ledgers_archive_created_at ON service_ledgers_archive(created_at);
 * - CREATE INDEX idx_archive_contract_created ON service_ledgers_archive(contract_id, created_at DESC);
 *   (Composite index for contract history queries)
 * - CREATE INDEX idx_archive_student_created ON service_ledgers_archive(student_id, created_at DESC);
 *   (Composite index for student history queries)
 * - CREATE INDEX idx_archive_service_created ON service_ledgers_archive(service_type, created_at DESC);
 *   (Composite index for service type history queries)
 * - CREATE INDEX idx_service_ledgers_archive_archived_at ON service_ledgers_archive(archived_at);
 *   (For archive maintenance queries)
 *
 * Archive query strategy and performance optimization (v2.16.4 Decision I5):
 *
 * 1. **Default query strategy (fast)**:
 *    - Only query service_ledgers table
 *    - Use case: Daily business queries (recent ledgers)
 *    - Performance: Optimal (no UNION ALL overhead)
 *
 * 2. **Complete history query (includeArchive=true)**:
 *    - Use UNION ALL to merge service_ledgers and service_ledgers_archive
 *    - **Must provide date range filter** (avoid full table scan)
 *    - Use case: Audit, historical analysis
 *
 * 3. **Required indexes (critical for performance)**:
 *    ```sql
 *    -- Archive table composite index (optimize contract queries)
 *    CREATE INDEX idx_archive_contract_created
 *      ON service_ledgers_archive(contract_id, created_at DESC);
 *
 *    -- Archive table composite index (optimize student queries)
 *    CREATE INDEX idx_archive_student_created
 *      ON service_ledgers_archive(student_id, created_at DESC);
 *
 *    -- Archive table composite index (optimize service type queries)
 *    CREATE INDEX idx_archive_service_created
 *      ON service_ledgers_archive(service_type, created_at DESC);
 *    ```
 *
 * 4. **Query examples (optimized)**:
 *    ```sql
 *    -- Example 1: Default query (main table only, fastest)
 *    SELECT * FROM service_ledgers
 *    WHERE contract_id = $1
 *    ORDER BY created_at DESC
 *    LIMIT 50;
 *
 *    -- Example 2: Complete history query (with date range, recommended)
 *    SELECT * FROM service_ledgers
 *    WHERE contract_id = $1 AND created_at >= $2
 *    UNION ALL
 *    SELECT id, contract_id, student_id, service_type, quantity, type, source,
 *           balance_after, related_hold_id, related_booking_id, reason,
 *           created_at, created_by, metadata, NULL as archived_at
 *    FROM service_ledgers_archive
 *    WHERE contract_id = $1 AND created_at >= $2
 *    ORDER BY created_at DESC;
 *
 *    -- Example 3: Student query (with pagination)
 *    SELECT * FROM (
 *      SELECT * FROM service_ledgers
 *      WHERE student_id = $1 AND created_at >= $2
 *      UNION ALL
 *      SELECT id, contract_id, student_id, service_type, quantity, type, source,
 *             balance_after, related_hold_id, related_booking_id, reason,
 *             created_at, created_by, metadata, NULL as archived_at
 *      FROM service_ledgers_archive
 *      WHERE student_id = $1 AND created_at >= $2
 *    ) AS combined
 *    ORDER BY created_at DESC
 *    LIMIT 20 OFFSET 0;
 *    ```
 *
 * 5. **Performance best practices**:
 *    - ✓ Always use date range filter (created_at >= ?)
 *    - ✓ Use composite indexes covering WHERE + ORDER BY
 *    - ✓ Limit returned rows (LIMIT clause)
 *    - ✗ Avoid UNION ALL without filters (performance killer)
 *    - ✗ Avoid SELECT * (only query needed columns)
 *
 * Archive process (service-ledger-archive.task.ts):
 * 1. Query service_ledger_archive_policies for active policies
 * 2. Determine archive cutoff date based on policy priority
 * 3. BEGIN TRANSACTION
 * 4. INSERT INTO service_ledgers_archive SELECT * FROM service_ledgers WHERE created_at < cutoff
 * 5. DELETE FROM service_ledgers WHERE created_at < cutoff (if deleteAfterArchive = true)
 * 6. COMMIT TRANSACTION
 * 7. Log archive metrics (records archived, records deleted)
 *
 * Archive cleanup (optional):
 * - Archived records can be further cleaned up based on retention policy
 * - Default: Keep archived records indefinitely
 * - Custom: Delete archived records older than X years
 */
