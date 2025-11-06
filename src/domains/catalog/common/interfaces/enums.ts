// Service type enum
export enum ServiceType {
  // One-on-one services
  GAP_ANALYSIS = "gap_analysis",
  RESUME_REVIEW = "resume_review",
  RECOMMENDATION_LETTER = "recommendation_letter",
  RECOMMENDATION_LETTER_ONLINE = "recommendation_letter_online",
  SESSION = "session",
  MOCK_INTERVIEW = "mock_interview",

  // Group services
  CLASS_SESSION = "class_session",

  // Special services
  INTERNAL_REFERRAL = "internal_referral",
  CONTRACT_SIGNING_ASSISTANCE = "contract_signing_assistance",
  PROXY_APPLICATION = "proxy_application",

  // Other
  OTHER_SERVICE = "other_service",
}

// Billing mode enum
export enum BillingMode {
  ONE_TIME = "one_time", // Per-time billing (e.g. resume review)
  PER_SESSION = "per_session", // Per-session billing (e.g. class)
  STAGED = "staged", // Staged billing (e.g. referral)
  PACKAGE = "package", // Package billing (sold as whole)
}

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
