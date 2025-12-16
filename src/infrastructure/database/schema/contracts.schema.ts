import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  numeric,
  json,
} from "drizzle-orm/pg-core";
import { ContractStatus } from "../../../shared/types/contract-enums";
import { Currency } from "../../../shared/types/catalog-enums";

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
  studentId: uuid("student_id").notNull(),

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
    items: Array<{
      productItemId: string;
      serviceTypeCode: string;
      quantity: number;
      sortOrder: number;
    }>; // Product items with expanded services
    snapshotAt: Date;
  }>(),

  // Contract status (using ContractStatus enum values)
  status: varchar("status", { length: 20 })
    .notNull()
    .default("DRAFT")
    .$type<ContractStatus>(),

  // Pricing information
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(), // Contract total amount (from snapshot)
  currency: varchar("currency", { length: 3 })
    .notNull()
    .default("USD")
    .$type<Currency>(),

  // Audit fields
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  createdBy: uuid("created_by").notNull(),
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
