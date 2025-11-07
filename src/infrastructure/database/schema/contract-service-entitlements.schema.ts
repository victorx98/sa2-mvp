import {
  pgTable,
  uuid,
  integer,
  timestamp,
  json,
  pgEnum,
} from "drizzle-orm/pg-core";
import { contracts } from "./contracts.schema";
import { serviceTypeEnum } from "./services.schema";

// Entitlement source enum
export const entitlementSourceEnum = pgEnum("entitlement_source", [
  "product", // Standard entitlement from product
  "addon", // Additional entitlement added by counselor
  "promotion", // Promotional entitlement
  "compensation", // Compensation entitlement
]);

/**
 * Contract service entitlements table
 * Represents service entitlements included in a contract
 *
 * Key features (v2.16.7):
 * - All services billed by times (no unit field)
 * - Unique constraint: (contract_id, service_type, expires_at, source)
 * - Automatic sync of consumed_quantity and held_quantity via triggers
 * - Balance calculation: available_quantity = total_quantity - consumed_quantity - held_quantity
 * - Service consumption priority: product > addon > promotion > compensation
 *
 * Design decision #7 (v2.16.4): Merge items with same service_type
 * - originItems field stores traceability for each merged item
 * - totalQuantity is sum of all merged items
 */
export const contractServiceEntitlements = pgTable(
  "contract_service_entitlements",
  {
    // Primary key
    id: uuid("id").defaultRandom().primaryKey(),

    // Contract reference
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),

    // Service identification
    serviceType: serviceTypeEnum("service_type").notNull(), // From Catalog Domain

    // Entitlement source
    source: entitlementSourceEnum("source").notNull().default("product"),

    // Quantity management (all in "times" - 次数)
    totalQuantity: integer("total_quantity").notNull(), // Total allocated quantity
    consumedQuantity: integer("consumed_quantity").notNull().default(0), // Consumed quantity (synced by trigger)
    heldQuantity: integer("held_quantity").notNull().default(0), // Held quantity (synced by trigger)
    availableQuantity: integer("available_quantity").notNull(), // Available quantity (total - consumed - held)

    // Service snapshot (frozen at entitlement creation time)
    serviceSnapshot: json("service_snapshot").notNull().$type<{
      serviceId: string;
      serviceName: string;
      serviceCode: string;
      serviceType: string;
      billingMode: string;
      requiresEvaluation: boolean;
      requiresMentorAssignment: boolean;
      metadata?: {
        features?: string[];
        deliverables?: string[];
        duration?: number;
      };
      snapshotAt: Date;
    }>(),

    // Origin items traceability (v2.16.4 - Decision #7)
    // Stores information about merged product items for audit trail
    originItems: json("origin_items").notNull().$type<
      Array<{
        productItemType: "service" | "service_package"; // Type of product item
        productItemId?: string; // Product item reference (if from product)
        quantity: number; // Original quantity
        servicePackageName?: string; // Service package name (if applicable)
      }>
    >(),

    // Validity period
    expiresAt: timestamp("expires_at", { withTimezone: true }), // Expiration time (inherited from contract, null = permanent)

    // Audit fields
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
);

// Type inference
export type ContractServiceEntitlement =
  typeof contractServiceEntitlements.$inferSelect;
export type InsertContractServiceEntitlement =
  typeof contractServiceEntitlements.$inferInsert;

/*
 * Unique constraint (v2.16.7):
 * - ALTER TABLE contract_service_entitlements ADD CONSTRAINT uq_entitlement_key
 *   UNIQUE (contract_id, service_type, expires_at, source);
 *
 * Indexes (to be created in contract_indexes.sql):
 * - CREATE INDEX idx_entitlements_contract_id ON contract_service_entitlements(contract_id);
 * - CREATE INDEX idx_entitlements_service_type ON contract_service_entitlements(service_type);
 * - CREATE INDEX idx_entitlements_source ON contract_service_entitlements(source);
 * - CREATE INDEX idx_entitlements_expires_at ON contract_service_entitlements(expires_at);
 * - CREATE INDEX idx_entitlements_available ON contract_service_entitlements(contract_id, service_type, available_quantity);
 *
 * Triggers (to be created in contract_triggers.sql):
 * - sync_consumed_quantity(): Updates consumed_quantity from service_ledgers
 * - sync_held_quantity(): Updates held_quantity from service_holds
 *
 * CHECK constraints (to be created in contract_constraints.sql):
 * - total_quantity >= 0
 * - consumed_quantity >= 0
 * - held_quantity >= 0
 * - available_quantity >= 0
 * - consumed_quantity + held_quantity <= total_quantity
 */
