import {
  pgTable,
  uuid,
  integer,
  boolean,
  timestamp,
  text,
  pgEnum,
  varchar,
} from "drizzle-orm/pg-core";
import { contracts } from "./contracts.schema";
import { serviceTypes } from "./service-types.schema";

// Archive policy scope enum
export const archivePolicyScopeEnum = pgEnum("archive_policy_scope", [
  "global", // Global default policy
  "contract", // Contract-level policy
  "service_type", // Service type-level policy
]);

/**
 * Service ledger archive policies table
 * Configuration for cold-hot data separation archive strategies
 *
 * Key features:
 * - Hierarchical policy scopes: global, contract, service_type
 * - Priority: contract > service_type > global
 * - Configurable archive period and deletion strategy
 * - Enable/disable policies without deletion
 *
 * Policy scopes:
 * 1. **Global policy**: Default archive rule for all ledgers (scope='global')
 * 2. **Contract-specific policy**: Custom archive rule per contract (scope='contract')
 * 3. **Service-type policy**: Custom archive rule per service type (scope='service_type')
 *
 * Policy resolution example:
 * - Contract A with contract-specific policy: Use contract policy
 * - Contract B for service_type 'resume_review' with service-type policy: Use service-type policy
 * - Contract C without specific policy: Use global policy
 * - Contract D with both contract and service-type policies: Use contract policy (higher priority)
 *
 * Default configuration:
 * - archiveAfterDays: 90 days
 * - deleteAfterArchive: false (keep data in main table after archiving)
 */
export const serviceLedgerArchivePolicies = pgTable(
  "service_ledger_archive_policies",
  {
    // Primary key
    id: uuid("id").defaultRandom().primaryKey(),

    // Policy scope
    scope: archivePolicyScopeEnum("scope").notNull(),

    // Associated entity (varies by scope)
    contractId: uuid("contract_id").references(() => contracts.id), // Required when scope='contract'
    serviceType: varchar("service_type", { length: 50 }).references(() => serviceTypes.code), // Required when scope='service_type'

    // Archive rules
    archiveAfterDays: integer("archive_after_days").notNull().default(90), // Archive after N days
    deleteAfterArchive: boolean("delete_after_archive")
      .notNull()
      .default(false), // Whether to delete from main table after archiving

    // Enabled status
    enabled: boolean("enabled").notNull().default(true),

    // Audit fields
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    createdBy: uuid("created_by"),
    notes: text("notes"), // Optional notes explaining the policy
  },
);

// Type inference
export type ServiceLedgerArchivePolicy =
  typeof serviceLedgerArchivePolicies.$inferSelect;
export type InsertServiceLedgerArchivePolicy =
  typeof serviceLedgerArchivePolicies.$inferInsert;

/*
 * Indexes (to be created in contract_indexes.sql):
 * - CREATE INDEX idx_service_ledger_archive_policies_scope ON service_ledger_archive_policies(scope);
 * - CREATE INDEX idx_service_ledger_archive_policies_contract ON service_ledger_archive_policies(contract_id);
 * - CREATE INDEX idx_service_ledger_archive_policies_service_type ON service_ledger_archive_policies(service_type);
 * - CREATE INDEX idx_service_ledger_archive_policies_enabled ON service_ledger_archive_policies(enabled);
 *   (For efficient policy lookup)
 *
 * Unique constraints (partial indexes to enforce one policy per scope):
 * - CREATE UNIQUE INDEX idx_service_ledger_archive_policies_unique_global
 *   ON service_ledger_archive_policies(scope) WHERE scope = 'global';
 *   (Only one global policy allowed)
 *
 * - CREATE UNIQUE INDEX idx_service_ledger_archive_policies_unique_contract
 *   ON service_ledger_archive_policies(contract_id) WHERE scope = 'contract';
 *   (Only one policy per contract)
 *
 * - CREATE UNIQUE INDEX idx_service_ledger_archive_policies_unique_service_type
 *   ON service_ledger_archive_policies(service_type) WHERE scope = 'service_type';
 *   (Only one policy per service type)
 *
 * CHECK constraints (to be created in contract_constraints.sql):
 * - ALTER TABLE service_ledger_archive_policies ADD CONSTRAINT chk_contract_scope_has_contract_id
 *   CHECK ((scope != 'contract') OR (contract_id IS NOT NULL));
 *   (When scope='contract', contract_id must be provided)
 *
 * - ALTER TABLE service_ledger_archive_policies ADD CONSTRAINT chk_service_type_scope_has_service_type
 *   CHECK ((scope != 'service_type') OR (service_type IS NOT NULL));
 *   (When scope='service_type', service_type must be provided)
 *
 * - ALTER TABLE service_ledger_archive_policies ADD CONSTRAINT chk_global_scope_no_entity
 *   CHECK ((scope != 'global') OR (contract_id IS NULL AND service_type IS NULL));
 *   (When scope='global', both contract_id and service_type must be NULL)
 *
 * - ALTER TABLE service_ledger_archive_policies ADD CONSTRAINT chk_archive_after_days_positive
 *   CHECK (archive_after_days > 0);
 *   (Archive period must be positive)
 *
 * Policy priority and resolution logic:
 * 1. **Contract-specific policy** (highest priority):
 *    - Query: WHERE scope='contract' AND contract_id = $1 AND enabled = true
 *    - Use archiveAfterDays from this policy
 *
 * 2. **Service-type policy** (medium priority):
 *    - Query: WHERE scope='service_type' AND service_type = $1 AND enabled = true
 *    - Use archiveAfterDays from this policy
 *
 * 3. **Global policy** (lowest priority):
 *    - Query: WHERE scope='global' AND enabled = true
 *    - Use archiveAfterDays from this policy (default: 90 days)
 *
 * Example policy resolution query:
 * ```sql
 * -- Get effective archive policy for a contract and service type
 * SELECT *
 * FROM service_ledger_archive_policies
 * WHERE enabled = true
 *   AND (
 *     (scope = 'contract' AND contract_id = $1) OR
 *     (scope = 'service_type' AND service_type = $2) OR
 *     (scope = 'global')
 *   )
 * ORDER BY
 *   CASE scope
 *     WHEN 'contract' THEN 1
 *     WHEN 'service_type' THEN 2
 *     WHEN 'global' THEN 3
 *   END
 * LIMIT 1;
 * ```
 *
 * Archive process using policies:
 * 1. Query active policies ordered by priority
 * 2. For each policy, determine archive cutoff date: NOW() - archiveAfterDays
 * 3. Archive ledger records older than cutoff date
 * 4. If deleteAfterArchive = true, delete archived records from main table
 * 5. Log archive metrics (policy applied, records archived, records deleted)
 *
 * Example policy configurations:
 * ```typescript
 * // Global default policy (archive after 90 days, keep in main table)
 * {
 *   scope: 'global',
 *   archiveAfterDays: 90,
 *   deleteAfterArchive: false,
 *   enabled: true,
 *   notes: 'Default archive policy for all ledgers'
 * }
 *
 * // High-value contract (keep longer, archive after 365 days)
 * {
 *   scope: 'contract',
 *   contractId: 'uuid-of-vip-contract',
 *   archiveAfterDays: 365,
 *   deleteAfterArchive: false,
 *   enabled: true,
 *   notes: 'VIP contract - extended retention period'
 * }
 *
 * // High-volume service type (archive aggressively after 30 days, delete from main table)
 * {
 *   scope: 'service_type',
 *   serviceType: 'online_class',
 *   archiveAfterDays: 30,
 *   deleteAfterArchive: true,
 *   enabled: true,
 *   notes: 'High-volume service - aggressive archiving for performance'
 * }
 * ```
 */
