import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  HttpStatus,
} from "@nestjs/common";

// Error message mapping table
export const CATALOG_ERROR_MESSAGES: Record<string, string> = {
  // Service related errors
  SERVICE_CODE_DUPLICATE: "Service code already exists",
  SERVICE_TYPE_DUPLICATE: "Service type already exists",
  SERVICE_NOT_FOUND: "Service not found",
  SERVICE_DELETED: "Service has been deleted",
  SERVICE_FIELD_IMMUTABLE: "Service field is immutable",
  SERVICE_IN_USE_WARNING:
    "Service is referenced, operation allowed with warning",
  SERVICE_IN_USE: "Service is in use and cannot be deleted",
  SERVICE_ACTIVE_CANNOT_DELETE: "Cannot delete active service",
  SERVICE_NOT_DELETED: "Service is not deleted, cannot restore",
  SERVICE_NOT_ACTIVE: "Service is not active",

  // ServicePackage related errors
  PACKAGE_CODE_DUPLICATE: "Service package code already exists",
  PACKAGE_NOT_FOUND: "Service package not found",
  PACKAGE_DELETED: "Service package has been deleted",
  PACKAGE_IN_USE_WARNING:
    "Service package is referenced, operation allowed with warning",
  PACKAGE_IN_USE: "Service package is in use and cannot be deleted",
  PACKAGE_ACTIVE_CANNOT_DELETE: "Cannot delete active service package",
  PACKAGE_NOT_DELETED: "Service package is not deleted, cannot restore",
  PACKAGE_MIN_SERVICES: "Service package must contain at least one service",
  SERVICE_ALREADY_IN_PACKAGE: "Service already exists in this package",

  // Product related errors
  PRODUCT_CODE_DUPLICATE: "Product code already exists",
  PRODUCT_NOT_FOUND: "Product not found",
  PRODUCT_DELETED: "Product has been deleted",
  PRODUCT_NOT_DRAFT: "Product is not in draft status",
  PRODUCT_NOT_ACTIVE: "Product is not active",
  PRODUCT_NOT_INACTIVE: "Product is not inactive",
  PRODUCT_NOT_DELETED: "Product is not deleted, cannot restore",
  PRODUCT_ALREADY_PUBLISHED: "Product has been published and cannot be edited",
  PRODUCT_FIELD_IMMUTABLE: "Product field is immutable",
  PRODUCT_NO_ITEMS: "Product must contain at least one item",
  PRODUCT_MIN_ITEMS: "Product must contain at least one item",
  PRODUCT_IN_USE: "Product is referenced by contracts and cannot be deleted",
  ITEM_ALREADY_IN_PRODUCT: "Item already exists in this product",
  PACKAGE_QUANTITY_MUST_BE_ONE: "Service package quantity must be 1",

  // Common validation errors
  INVALID_PRICE: "Price must be greater than 0",
  INVALID_CURRENCY: "Invalid currency code (only USD/CNY supported)",
  INVALID_VALIDITY_DAYS: "Validity days must be greater than 0 or NULL",
  INVALID_QUANTITY: "Quantity must be greater than 0",
  INVALID_QUERY: "At least one query condition (id or code) must be provided",
  REFERENCE_NOT_FOUND: "Referenced resource not found",
  REFERENCE_NOT_ACTIVE: "Referenced resource is not active",
  REASON_REQUIRED: "Reason is required",
  SERVICE_TYPE_NOT_FOUND: "Service type not found",
};

// Custom exception base class
export class CatalogException extends BadRequestException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.BAD_REQUEST,
      code,
      message: message || CATALOG_ERROR_MESSAGES[code] || "Unknown error",
    });
  }
}

// 404 Not Found exception
export class CatalogNotFoundException extends NotFoundException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.NOT_FOUND,
      code,
      message: message || CATALOG_ERROR_MESSAGES[code] || "Resource not found",
    });
  }
}

// 409 Conflict exception
export class CatalogConflictException extends ConflictException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.CONFLICT,
      code,
      message: message || CATALOG_ERROR_MESSAGES[code] || "Resource conflict",
    });
  }
}

// 410 Gone exception (resource has been deleted)
export class CatalogGoneException extends BadRequestException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.GONE,
      code,
      message:
        message || CATALOG_ERROR_MESSAGES[code] || "Resource has been deleted",
    });
  }
}
