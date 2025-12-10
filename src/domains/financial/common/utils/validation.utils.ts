/**
 * Validation utility functions for Financial Domain
 * [Financial域验证工具函数]
 */

import { FinancialException } from "../exceptions/financial.exception";

/**
 * Validate mentor price amount
 * [验证导师价格金额]
 * @param price Price amount
 * @returns True if valid, throws FinancialException otherwise
 */
export function validateMentorPrice(price: number): boolean {
  if (price <= 0) {
    throw new FinancialException(
      "INVALID_PRICE",
      "Price must be greater than 0",
    );
  }

  // Allow 1 decimal place for price amounts [允许价格保留1位小数]
  const decimalPlaces = price.toString().split(".")[1]?.length || 0;
  if (decimalPlaces > 1) {
    throw new FinancialException(
      "INVALID_PRICE",
      "Price must have at most 1 decimal place",
    );
  }

  // Check precision: 12 digits total [检查精度：总共12位]
  const priceStr = price.toString().replace(".", "");
  if (priceStr.length > 12) {
    throw new FinancialException(
      "INVALID_PRICE",
      "Price precision cannot exceed 12 digits total",
    );
  }

  return true;
}

/**
 * Validate currency code
 * [验证货币代码]
 * @param currency Currency code (ISO 4217 format)
 * @returns True if valid, throws FinancialException otherwise
 */
export function validateCurrency(currency: string): boolean {
  if (!currency || currency.length !== 3) {
    throw new FinancialException(
      "INVALID_CURRENCY",
      "Currency code must be 3 characters (ISO 4217 format)",
    );
  }

  // Basic validation: should be uppercase letters [基本验证：应为大写字母]
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new FinancialException(
      "INVALID_CURRENCY",
      "Currency code must be 3 uppercase letters (ISO 4217 format)",
    );
  }

  return true;
}

/**
 * Validate status value
 * [验证状态值]
 * @param status Status value
 * @returns True if valid, throws FinancialException otherwise
 */
export function validateStatus(status: string): boolean {
  const validStatuses = ["active", "inactive"];
  if (!validStatuses.includes(status)) {
    throw new FinancialException(
      "INVALID_STATUS",
      `Status must be one of: ${validStatuses.join(", ")}`,
    );
  }
  return true;
}
