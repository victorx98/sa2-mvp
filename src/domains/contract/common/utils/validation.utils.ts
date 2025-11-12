/**
 * Validation utility functions for Contract Domain
 */

import {
  MIN_CONTRACT_AMOUNT,
  MAX_CONTRACT_AMOUNT,
  MIN_SERVICE_QUANTITY,
  MAX_SERVICE_QUANTITY,
} from "../constants/contract.constants";

/**
 * Validate price amount
 * @param amount Price amount in cents
 * @returns True if valid, throws error otherwise
 */
export function validatePrice(amount: number): boolean {
  if (amount < MIN_CONTRACT_AMOUNT) {
    throw new Error(`Price must be at least ${MIN_CONTRACT_AMOUNT} cents`);
  }

  if (amount > MAX_CONTRACT_AMOUNT) {
    throw new Error(`Price cannot exceed ${MAX_CONTRACT_AMOUNT} cents`);
  }

  if (!Number.isInteger(amount)) {
    throw new Error("Price must be an integer (cents)");
  }

  return true;
}

/**
 * Validate service quantity
 * @param quantity Service quantity
 * @returns True if valid, throws error otherwise
 */
export function validateQuantity(quantity: number): boolean {
  if (quantity < MIN_SERVICE_QUANTITY) {
    throw new Error(`Quantity must be at least ${MIN_SERVICE_QUANTITY}`);
  }

  if (quantity > MAX_SERVICE_QUANTITY) {
    throw new Error(`Quantity cannot exceed ${MAX_SERVICE_QUANTITY}`);
  }

  if (!Number.isInteger(quantity)) {
    throw new Error("Quantity must be an integer");
  }

  return true;
}

/**
 * Validate validity days
 * @param validityDays Validity period in days
 * @returns True if valid, throws error otherwise
 */
export function validateValidityDays(validityDays: number | null): boolean {
  if (validityDays === null || validityDays === undefined) {
    return true; // Permanent contract is valid
  }

  if (validityDays <= 0) {
    throw new Error("Validity days must be greater than 0 or null");
  }

  if (!Number.isInteger(validityDays)) {
    throw new Error("Validity days must be an integer");
  }

  return true;
}

/**
 * Validate balance calculation
 * @param totalQuantity Total allocated quantity
 * @param consumedQuantity Consumed quantity
 * @param heldQuantity Held quantity
 * @returns True if valid, throws error otherwise
 */
export function validateBalanceConsistency(
  totalQuantity: number,
  consumedQuantity: number,
  heldQuantity: number,
): boolean {
  if (consumedQuantity < 0) {
    throw new Error("Consumed quantity cannot be negative");
  }

  if (heldQuantity < 0) {
    throw new Error("Held quantity cannot be negative");
  }

  if (consumedQuantity + heldQuantity > totalQuantity) {
    throw new Error("Consumed + held quantity cannot exceed total quantity");
  }

  const expectedAvailable = totalQuantity - consumedQuantity - heldQuantity;
  if (expectedAvailable < 0) {
    throw new Error("Available quantity cannot be negative");
  }

  return true;
}

/**
 * Validate UUID format
 * @param uuid UUID string
 * @returns True if valid UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate contract number format
 * @param contractNumber Contract number string
 * @returns True if valid format
 */
export function isValidContractNumber(contractNumber: string): boolean {
  const regex = /^CONTRACT-\d{4}-\d{2}-\d{5}$/;
  return regex.test(contractNumber);
}

/**
 * Validate currency code
 * @param currency Currency code (e.g., 'USD', 'CNY')
 * @returns True if valid
 */
export function isValidCurrency(currency: string): boolean {
  const supportedCurrencies = ["USD", "CNY", "EUR", "GBP", "JPY"];
  return supportedCurrencies.includes(currency.toUpperCase());
}

/**
 * Validate required fields for FindOne queries
 * @param filter Filter object
 * @returns True if at least one query field is provided
 */
export function hasQueryCondition(filter: Record<string, unknown>): boolean {
  const queryFields = ["contractId", "contractNumber", "studentId", "status"];
  return queryFields.some(
    (field) => filter[field] !== undefined && filter[field] !== null,
  );
}

/**
 * Sanitize reason text (remove excessive whitespace, enforce length limits)
 * @param reason Reason text
 * @param maxLength Maximum length (default: 500)
 * @returns Sanitized reason text
 */
export function sanitizeReason(
  reason: string,
  maxLength: number = 500,
): string {
  // Trim and collapse multiple spaces
  let sanitized = reason.trim().replace(/\s+/g, " ");

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Check if value is a positive number
 * @param value Value to check
 * @returns True if positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && value > 0 && !isNaN(value);
}

/**
 * Check if value is a non-negative number
 * @param value Value to check
 * @returns True if non-negative number
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && !isNaN(value);
}

/**
 * Validate ledger quantity change based on operation type
 * @param operationType Operation type ('consumption' or 'adjustment')
 * @param quantityChange Quantity change value
 * @returns True if valid
 */
export function validateLedgerQuantity(
  operationType: "consumption" | "adjustment",
  quantityChange: number,
): boolean {
  if (quantityChange === 0) {
    throw new Error("Quantity change cannot be zero");
  }

  if (operationType === "consumption" && quantityChange >= 0) {
    throw new Error("Consumption quantity must be negative");
  }

  return true;
}
