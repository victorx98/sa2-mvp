// ============================================================================
// Product Snapshot Types
// ============================================================================

import { BillingMode, Currency } from "@shared/types/catalog-enums";

/**
 * Product snapshot captured at contract creation
 * Frozen state of product to ensure contract immutability
 */
export interface IProductSnapshot {
  productId: string;
  productName: string;
  productCode: string;
  price: string; // Stored as string to maintain precision
  currency: Currency; // e.g., 'USD', 'CNY'
  validityDays?: number; // null = permanent validity
  items: IProductItemSnapshot[]; // Expanded product items with services
  snapshotAt: Date; // When snapshot was taken
}

/**
 * Product item snapshot (service or service_package)
 */
export interface IProductItemSnapshot {
  productItemId: string;
  productItemType: "service" | "service_package";
  referenceId: string; // serviceId or servicePackageId
  quantity: number; // Quantity in product
  sortOrder: number;

  // Service details (when type = 'service')
  service?: IServiceSnapshot;

  // Service package details (when type = 'service_package')
  servicePackage?: IServicePackageSnapshot;
}

// ============================================================================
// Service Snapshot Types
// ============================================================================

/**
 * Service snapshot captured from Catalog Domain
 * Required for service entitlements (Decision #6 - v2.16.4)
 */
export interface IServiceSnapshot {
  serviceId: string;
  serviceName: string;
  serviceCode: string;
  serviceType: string; // e.g., 'resume_review', 'mock_interview'
  billingMode: BillingMode;
  requiresEvaluation: boolean;
  requiresMentorAssignment: boolean;
  metadata?: {
    features?: string[]; // Service features
    deliverables?: string[]; // Expected deliverables
    duration?: number; // Duration in minutes (informational only, not used for billing)
    [key: string]: unknown; // Additional metadata
  };
  snapshotAt: Date;
}

// ============================================================================
// Service Package Snapshot Types
// ============================================================================

/**
 * Service package snapshot captured from Catalog Domain
 */
export interface IServicePackageSnapshot {
  servicePackageId: string;
  servicePackageName: string;
  servicePackageCode: string;
  items: IServicePackageItemSnapshot[]; // Services in this package
  snapshotAt: Date;
}

/**
 * Service package item snapshot
 */
export interface IServicePackageItemSnapshot {
  servicePackageItemId: string;
  serviceId: string;
  quantity: number; // Quantity of this service in the package
  sortOrder: number;
  service: IServiceSnapshot; // Expanded service details
}

// ============================================================================
// Origin Items Traceability (v2.16.4 Decision #7)
// ============================================================================

/**
 * Origin item traceability for merged entitlements
 * Tracks which product items contributed to an entitlement
 */
export interface IOriginItem {
  productItemType: "service" | "service_package";
  productItemId?: string; // Product item reference (if from product)
  quantity: number; // Original quantity from this product item
  servicePackageName?: string; // Service package name (if applicable)
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Entitlement source type
 */
export type EntitlementSource =
  | "product"
  | "addon"
  | "promotion"
  | "compensation";

/**
 * Contract status type
 */
export type ContractStatus =
  | "signed"
  | "active"
  | "suspended"
  | "completed"
  | "terminated";

/**
 * Hold status type
 */
export type HoldStatus = "active" | "released" | "expired";

/**
 * Ledger operation type
 */
export type LedgerOperationType = "consumption" | "adjustment";

/**
 * Event status type
 */
export type EventStatus = "pending" | "published" | "failed";

/**
 * Archive policy scope type
 */
export type ArchivePolicyScope = "global" | "contract" | "service_type";

// ============================================================================
// Database Query Result Types
// ============================================================================

/**
 * Result type for generate_contract_number_v2() database function
 */
export interface IGenerateContractNumberResult {
  contract_number: string;
}

/**
 * Entitlement aggregation map entry for internal processing
 * Used when deriving entitlements from product snapshot
 */
export interface IEntitlementAggregation {
  serviceType: string;
  totalQuantity: number;
  serviceSnapshot: IServiceSnapshot;
  originItems: IOriginItem[];
}
