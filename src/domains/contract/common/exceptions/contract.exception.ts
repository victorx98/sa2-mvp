import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  HttpStatus,
  UnprocessableEntityException,
} from "@nestjs/common";

// Error message mapping table
export const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  // Contract related errors
  CONTRACT_NOT_FOUND: "Contract not found",
  CONTRACT_NUMBER_DUPLICATE: "Contract number already exists",
  CONTRACT_NOT_DRAFT: "Contract is not in draft status",
  CONTRACT_NOT_DRAFT_CORE_FIELDS:
    "Core fields can only be updated for draft contracts",
  CONTRACT_NOT_ACTIVE: "Contract is not active",
  CONTRACT_NOT_SUSPENDED: "Contract is not suspended",
  CONTRACT_NOT_TERMINATABLE: "Contract cannot be terminated in current status",
  CONTRACT_ALREADY_ACTIVATED: "Contract has already been activated",
  CONTRACT_ALREADY_TERMINATED: "Contract has already been terminated",
  CONTRACT_ALREADY_COMPLETED: "Contract has already been completed",
  CONTRACT_EXPIRED: "Contract has expired",
  TERMINATION_REQUIRES_REASON: "Contract termination must provide a reason",
  SUSPENSION_REQUIRES_REASON: "Contract suspension must provide a reason",
  CONTRACT_NUMBER_LIMIT_EXCEEDED:
    "Contract number limit exceeded for this month (max 99999)",
  CONTRACT_MULTIPLE_FOUND:
    "Multiple contracts found, query condition is not unique",

  // Service entitlement related errors
  ENTITLEMENT_NOT_FOUND: "Service entitlement not found",
  INSUFFICIENT_BALANCE: "Insufficient service balance",
  ENTITLEMENT_EXPIRED: "Service entitlement has expired",
  ENTITLEMENT_ALREADY_EXISTS:
    "Service entitlement already exists for this contract and service type",
  ENTITLEMENT_NOT_AVAILABLE: "Service entitlement is not available",

  // Service hold related errors
  HOLD_NOT_FOUND: "Service hold not found",
  HOLD_EXPIRED: "Service hold has expired",
  HOLD_ALREADY_RELEASED: "Service hold has already been released",
  HOLD_NOT_ACTIVE: "Service hold is not active",
  HOLD_CANNOT_RELEASE: "Service hold cannot be released in current status",

  // Service ledger related errors
  LEDGER_NOT_FOUND: "Service ledger not found",
  LEDGER_BALANCE_NEGATIVE: "Balance cannot be negative",
  LEDGER_QUANTITY_ZERO: "Quantity change cannot be zero",
  LEDGER_ADJUSTMENT_REQUIRES_REASON:
    "Adjustment operations must provide a reason",
  LEDGER_IMMUTABLE: "Service ledger is immutable (append-only)",

  // Archive related errors
  ARCHIVE_QUERY_REQUIRES_DATE_RANGE:
    "Archive queries must provide date range filter (max 1 year)",
  ARCHIVE_DATE_RANGE_TOO_LARGE: "Date range cannot exceed 1 year",
  ARCHIVE_POLICY_NOT_FOUND: "Archive policy not found",
  ARCHIVE_POLICY_ALREADY_EXISTS: "Archive policy already exists for this scope",
  ARCHIVE_AFTER_DAYS_TOO_SMALL: "Archive after days must be at least 1",

  // Domain event related errors
  EVENT_NOT_FOUND: "Domain event not found",
  EVENT_ALREADY_PUBLISHED: "Event has already been published",
  EVENT_RETRY_LIMIT_EXCEEDED: "Event retry limit exceeded",
  EVENT_PUBLISH_FAILED: "Failed to publish event",

  // Product snapshot related errors
  PRODUCT_NOT_FOUND: "Product not found in catalog domain",
  PRODUCT_SNAPSHOT_INVALID: "Product snapshot is invalid or incomplete",
  PRODUCT_NOT_ACTIVE: "Product is not active",
  SERVICE_NOT_FOUND_IN_CATALOG: "Service not found in catalog domain",

  // Price override related errors
  PRICE_OVERRIDE_TOO_HIGH: "Override price exceeds maximum allowed amount",
  PRICE_OVERRIDE_TOO_LOW: "Override price is below minimum allowed amount",
  PRICE_OVERRIDE_REQUIRES_REASON: "Price override must provide a reason",
  PRICE_OVERRIDE_REQUIRES_APPROVER: "Price override must have an approver",
  PRICE_OVERRIDE_UNAUTHORIZED: "Unauthorized to override price",

  // Status transition errors
  INVALID_STATUS_TRANSITION:
    "Invalid status transition for current contract state",
  STATUS_TRANSITION_REQUIRES_REASON:
    "Status transition requires a reason (e.g., terminate, suspend)",
  SUSPEND_REQUIRES_ADMIN: "Only administrators can suspend contracts",
  RESUME_REQUIRES_ADMIN: "Only administrators can resume contracts",
  CANNOT_TERMINATE_DRAFT: "Cannot terminate draft contracts",
  CANNOT_COMPLETE_DRAFT: "Cannot complete draft contracts",

  // Consumption related errors
  CONSUMPTION_PRIORITY_NOT_FOUND: "No entitlement found with required priority",
  CONSUMPTION_QUANTITY_INVALID: "Consumption quantity must be positive",
  HOLD_QUANTITY_INVALID: "Hold quantity must be positive",
  HOLD_TTL_INVALID: "Hold TTL must be positive",

  // Validation errors
  INVALID_PRICE: "Price must be greater than 0",
  INVALID_CURRENCY: "Invalid currency code",
  INVALID_VALIDITY_DAYS: "Validity days must be greater than 0 or NULL",
  INVALID_QUANTITY: "Quantity must be greater than 0",
  INVALID_SERVICE_TYPE: "Invalid service type",
  INVALID_QUERY: "At least one query condition must be provided",
  REASON_REQUIRED: "Reason is required for this operation",

  // Concurrent control errors
  CONCURRENT_MODIFICATION: "Resource has been modified by another operation",
  LOCK_TIMEOUT: "Failed to acquire lock within timeout period",
  OPTIMISTIC_LOCK_FAILED: "Optimistic lock version mismatch",
};

// Custom exception base class (400 Bad Request)
export class ContractException extends BadRequestException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.BAD_REQUEST,
      code,
      message: message || CONTRACT_ERROR_MESSAGES[code] || "Unknown error",
    });
  }
}

// 404 Not Found exception
export class ContractNotFoundException extends NotFoundException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.NOT_FOUND,
      code,
      message: message || CONTRACT_ERROR_MESSAGES[code] || "Resource not found",
    });
  }
}

// 409 Conflict exception
export class ContractConflictException extends ConflictException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.CONFLICT,
      code,
      message: message || CONTRACT_ERROR_MESSAGES[code] || "Resource conflict",
    });
  }
}

// 410 Gone exception (resource has been deleted/expired)
export class ContractGoneException extends BadRequestException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.GONE,
      code,
      message:
        message ||
        CONTRACT_ERROR_MESSAGES[code] ||
        "Resource has been deleted or expired",
    });
  }
}

// 422 Unprocessable Entity exception (validation/business rule failure)
export class ContractUnprocessableException extends UnprocessableEntityException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      code,
      message:
        message ||
        CONTRACT_ERROR_MESSAGES[code] ||
        "Unable to process request due to business rule violation",
    });
  }
}
