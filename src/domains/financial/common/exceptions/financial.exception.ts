import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  HttpStatus,
} from "@nestjs/common";

// Error message mapping table [错误消息映射表]
export const FINANCIAL_ERROR_MESSAGES: Record<string, string> = {
  // Mentor price related errors [导师价格相关错误]
  MENTOR_PRICE_NOT_FOUND: "Mentor price not found",
  MENTOR_PRICE_ALREADY_EXISTS:
    "Mentor price already exists for this mentor and session type",
  MENTOR_PRICE_INVALID_STATUS:
    "Mentor price status is invalid for this operation",

  // Class mentor price related errors [班级导师价格相关错误]
  CLASS_MENTOR_PRICE_NOT_FOUND: "Class mentor price not found",
  CLASS_MENTOR_PRICE_ALREADY_EXISTS:
    "Class mentor price already exists for this class and mentor",
  CLASS_MENTOR_PRICE_INVALID_STATUS:
    "Class mentor price status is invalid for this operation",

  // Validation errors [验证错误]
  INVALID_PRICE:
    "Price must be greater than 0 and have at most 1 decimal place",
  INVALID_CURRENCY: "Invalid currency code",
  INVALID_STATUS: "Invalid status value. Must be 'active' or 'inactive'",
  MENTOR_NOT_FOUND: "Mentor not found",
  CLASS_NOT_FOUND: "Class not found",
  SESSION_TYPE_NOT_FOUND: "Session type not found",
  INVALID_QUERY: "At least one query condition must be provided",

  // Bulk operation errors [批量操作错误]
  BULK_OPERATION_FAILED: "Bulk operation failed",
  BULK_VALIDATION_FAILED: "Bulk operation validation failed",
};

// Custom exception base class (400 Bad Request) [自定义异常基类]
export class FinancialException extends BadRequestException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.BAD_REQUEST,
      code,
      message: message || FINANCIAL_ERROR_MESSAGES[code] || "Unknown error",
    });
  }
}

// 404 Not Found exception
export class FinancialNotFoundException extends NotFoundException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.NOT_FOUND,
      code,
      message:
        message || FINANCIAL_ERROR_MESSAGES[code] || "Resource not found",
    });
  }
}

// 409 Conflict exception
export class FinancialConflictException extends ConflictException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.CONFLICT,
      code,
      message: message || FINANCIAL_ERROR_MESSAGES[code] || "Resource conflict",
    });
  }
}
