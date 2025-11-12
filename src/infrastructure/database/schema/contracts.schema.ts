import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  numeric,
  integer,
  json,
  pgEnum,
} from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";
import { currencyEnum } from "./products.schema";

// Contract status enum
export const contractStatusEnum = pgEnum("contract_status", [
  "draft", // Initial state (contract created but not signed)
  "signed", // Contract signed, pending activation
  "active", // Contract activated, can consume services
  "suspended", // Temporarily suspended
  "completed", // Successfully completed
  "terminated", // Terminated (refund/cancellation)
]);

/**
 * Contracts table
 * Represents service contracts between students and the platform
 *
 * Key features:
 * - One-to-one binding with product (via productId UUID reference)
 * - No foreign key to products table (DDD anti-corruption layer)
 * - Contract lifecycle: signed → active → suspended/completed/terminated
 * - Price override support for discounts/promotions
 */
export const contracts = pgTable("contracts", {
  // Primary key
  id: uuid("id").defaultRandom().primaryKey(),

  // Contract identification
  contractNumber: varchar("contract_number", { length: 50 }).notNull().unique(), // e.g., 'CONTRACT-2025-01-00001'
  title: varchar("title", { length: 200 }), // Contract title (optional)

  // Student reference
  studentId: varchar("student_id", { length: 32 })
    .notNull()
    .references(() => userTable.id, { onDelete: "restrict" }),

  // Product reference (UUID, no foreign key - DDD anti-corruption layer)
  productId: uuid("product_id").notNull(), // Reference to Catalog Domain product

  // Product snapshot (frozen at contract creation time)
  productSnapshot: json("product_snapshot").notNull().$type<{
    productId: string;
    productName: string;
    productCode: string;
    price: string;
    currency: string;
    validityDays?: number;
    items: any[]; // Product items with expanded services
    snapshotAt: Date;
  }>(),

  // Contract status
  status: contractStatusEnum("status").notNull().default("draft"),

  // Pricing information
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(), // Contract total amount (from snapshot)
  currency: currencyEnum("currency").notNull().default("USD"),

  // Validity period
  validityDays: integer("validity_days"), // Validity period in days (null = permanent)
  signedAt: timestamp("signed_at", { withTimezone: true }).notNull(), // Contract signing time
  activatedAt: timestamp("activated_at", { withTimezone: true }), // Contract activation time
  expiresAt: timestamp("expires_at", { withTimezone: true }), // Expiration time (null = permanent)

  // Contract lifecycle timestamps
  suspendedAt: timestamp("suspended_at", { withTimezone: true }), // Last suspension time
  resumedAt: timestamp("resumed_at", { withTimezone: true }), // Last resumption time
  completedAt: timestamp("completed_at", { withTimezone: true }), // Completion time
  terminatedAt: timestamp("terminated_at", { withTimezone: true }), // Termination time

  // Suspension tracking
  suspensionCount: integer("suspension_count").notNull().default(0), // Number of suspensions

  // Audit fields
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  createdBy: varchar("created_by", { length: 32 })
    .notNull()
    .references(() => userTable.id),
});

// Type inference
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

/*
 * Indexes (to be created in contract_indexes.sql):
 * - CREATE INDEX idx_contracts_contract_number ON contracts(contract_number);
 * - CREATE INDEX idx_contracts_student_id ON contracts(student_id);
 * - CREATE INDEX idx_contracts_product_id ON contracts(product_id);
 * - CREATE INDEX idx_contracts_status ON contracts(status);
 * - CREATE INDEX idx_contracts_expires_at ON contracts(expires_at);
 * - CREATE INDEX idx_contracts_student_status ON contracts(student_id, status);
 * - CREATE INDEX idx_contracts_student_product ON contracts(student_id, product_id);
 *
 * CHECK constraints (to be created in contract_constraints.sql):
 * - Price override validation
 * - Status transition validation
 * - Validity period validation
 */
