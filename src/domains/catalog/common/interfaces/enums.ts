// Billing mode enum
export enum BillingMode {
  ONE_TIME = "one_time", // Per-time billing (e.g. resume review)
  PER_SESSION = "per_session", // Per-session billing (e.g. class)
  STAGED = "staged", // Staged billing (e.g. referral)
  PACKAGE = "package", // Package billing (sold as whole)
}

// Re-export ServiceType from database schema
export type { ServiceType } from "@infrastructure/database/schema/service-types.schema";

// Unit enum
export enum ServiceUnit {
  TIMES = "times", // Times
  HOURS = "hours", // Hours
}

// Service/Service package status enum
export enum ServiceStatus {
  ACTIVE = "active", // Active
  INACTIVE = "inactive", // Inactive
  DELETED = "deleted", // Deleted
}

// Product status enum
export enum ProductStatus {
  DRAFT = "draft", // Draft
  ACTIVE = "active", // Active
  INACTIVE = "inactive", // Inactive
  DELETED = "deleted", // Deleted
}

// Currency enum
export enum Currency {
  USD = "USD", // US Dollar
  CNY = "CNY", // Chinese Yuan
  EUR = "EUR", // Euro (reserved)
  GBP = "GBP", // British Pound (reserved)
  JPY = "JPY", // Japanese Yen (reserved)
}

// User type enum
export enum UserType {
  UNDERGRADUATE = "undergraduate", // Undergraduate
  GRADUATE = "graduate", // Graduate
  WORKING = "working", // Working professional
}

// Product item type enum
export enum ProductItemType {
  SERVICE = "service", // Direct service
  SERVICE_PACKAGE = "service_package", // Service package
}

// Marketing label type
export type MarketingLabel = "hot" | "new" | "recommended";
