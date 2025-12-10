/**
 * Validation utility functions for Contract Domain
 * [Contract域验证工具函数]
 */

import {
  MIN_CONTRACT_AMOUNT_DOLLARS,
  MAX_CONTRACT_AMOUNT_DOLLARS,
  MIN_SERVICE_QUANTITY,
  MAX_SERVICE_QUANTITY,
} from "../constants/contract.constants";
import { ContractException } from "../exceptions/contract.exception";

/**
 * Validate price amount
 * [验证价格金额]
 * @param amount Price amount in dollars
 * @returns True if valid, throws ContractException otherwise
 */
export function validatePrice(amount: number): boolean {
  if (amount < MIN_CONTRACT_AMOUNT_DOLLARS) {
    throw new ContractException(
      `Price must be at least ${MIN_CONTRACT_AMOUNT_DOLLARS} dollars`,
    );
  }

  if (amount > MAX_CONTRACT_AMOUNT_DOLLARS) {
    throw new ContractException(
      `Price cannot exceed ${MAX_CONTRACT_AMOUNT_DOLLARS} dollars`,
    );
  }

  // Allow 1 decimal place for dollar amounts
  const decimalPlaces = amount.toString().split(".")[1]?.length || 0;
  if (decimalPlaces > 1) {
    throw new ContractException(
      "Price must have at most 1 decimal place (dollars)",
    );
  }

  return true;
}

/**
 * Validate service quantity
 * [验证服务数量]
 * @param quantity Service quantity
 * @returns True if valid, throws ContractException otherwise
 */
export function validateQuantity(quantity: number): boolean {
  if (quantity < MIN_SERVICE_QUANTITY) {
    throw new ContractException(
      `Quantity must be at least ${MIN_SERVICE_QUANTITY}`,
    );
  }

  if (quantity > MAX_SERVICE_QUANTITY) {
    throw new ContractException(
      `Quantity cannot exceed ${MAX_SERVICE_QUANTITY}`,
    );
  }

  if (!Number.isInteger(quantity)) {
    throw new ContractException("Quantity must be an integer");
  }

  return true;
}

/**
 * Validate validity days
 * [验证有效天数]
 * @param validityDays Validity period in days
 * @returns True if valid, throws ContractException otherwise
 */
export function validateValidityDays(validityDays: number | null): boolean {
  if (validityDays === null || validityDays === undefined) {
    return true; // Permanent contract is valid
  }

  if (validityDays <= 0) {
    throw new ContractException("Validity days must be greater than 0 or null");
  }

  if (!Number.isInteger(validityDays)) {
    throw new ContractException("Validity days must be an integer");
  }

  return true;
}

/**
 * Validate balance calculation
 * [验证余额计算]
 * @param totalQuantity Total allocated quantity
 * @param consumedQuantity Consumed quantity
 * @param heldQuantity Held quantity
 * @returns True if valid, throws ContractException otherwise
 */
export function validateBalanceConsistency(
  totalQuantity: number,
  consumedQuantity: number,
  heldQuantity: number,
): boolean {
  if (consumedQuantity < 0) {
    throw new ContractException("Consumed quantity cannot be negative");
  }

  if (heldQuantity < 0) {
    throw new ContractException("Held quantity cannot be negative");
  }

  if (consumedQuantity + heldQuantity > totalQuantity) {
    throw new ContractException(
      "Consumed + held quantity cannot exceed total quantity",
    );
  }

  const expectedAvailable = totalQuantity - consumedQuantity - heldQuantity;
  if (expectedAvailable < 0) {
    throw new ContractException("Available quantity cannot be negative");
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

/**
 * Validate product snapshot structure
 * [验证产品快照结构]
 * @param snapshot Product snapshot to validate
 * @returns True if valid, throws ContractException otherwise
 */
export function validateProductSnapshot(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== "object") {
    throw new ContractException("Product snapshot must be an object");
  }

  const snap = snapshot as Record<string, unknown>;

  // Validate required fields
  const requiredFields = [
    "productId",
    "productName",
    "productCode",
    "price",
    "currency",
    "items",
    "snapshotAt",
  ];

  for (const field of requiredFields) {
    if (!(field in snap) || snap[field] === undefined || snap[field] === null) {
      throw new ContractException(
        `Product snapshot missing required field: ${field}`,
      );
    }
  }

  // Validate string fields
  if (
    typeof snap.productId !== "string" ||
    typeof snap.productName !== "string" ||
    typeof snap.productCode !== "string" ||
    typeof snap.price !== "string" ||
    typeof snap.currency !== "string"
  ) {
    throw new ContractException(
      "Product snapshot string fields must be of type string",
    );
  }

  // Validate UUID format
  if (!isValidUUID(snap.productId as string)) {
    throw new ContractException(
      "Product snapshot productId must be a valid UUID",
    );
  }

  // Validate price format
  const price = parseFloat(snap.price as string);
  if (isNaN(price) || price < 0) {
    throw new ContractException(
      "Product snapshot price must be a valid positive number",
    );
  }

  // Validate currency
  if (!isValidCurrency(snap.currency as string)) {
    throw new ContractException(
      "Product snapshot currency must be a supported currency code",
    );
  }

  // Validate items array
  if (!Array.isArray(snap.items)) {
    throw new ContractException("Product snapshot items must be an array");
  }

  if (snap.items.length === 0) {
    throw new ContractException("Product snapshot items array cannot be empty");
  }

  // Validate each item
  for (const item of snap.items) {
    if (!item || typeof item !== "object") {
      throw new ContractException("Product snapshot item must be an object");
    }

    const itemObj = item as Record<string, unknown>;

    // Validate required item fields
    if (
      !itemObj.productItemId ||
      typeof itemObj.productItemId !== "string" ||
      !isValidUUID(itemObj.productItemId as string)
    ) {
      throw new ContractException(
        "Product snapshot item productItemId must be a valid UUID",
      );
    }

    if (
      !itemObj.serviceTypeCode ||
      typeof itemObj.serviceTypeCode !== "string"
    ) {
      throw new ContractException(
        "Product snapshot item serviceTypeCode must be a valid string",
      );
    }

    if (
      !itemObj.quantity ||
      typeof itemObj.quantity !== "number" ||
      itemObj.quantity <= 0 ||
      !Number.isInteger(itemObj.quantity)
    ) {
      throw new ContractException(
        "Product snapshot item quantity must be a positive integer",
      );
    }

    if (
      itemObj.sortOrder === undefined ||
      typeof itemObj.sortOrder !== "number" ||
      !Number.isInteger(itemObj.sortOrder)
    ) {
      throw new ContractException(
        "Product snapshot item sortOrder must be an integer",
      );
    }
  }

  // Validate snapshotAt is a valid date
  const snapshotAt = new Date(snap.snapshotAt as string | number | Date);
  if (isNaN(snapshotAt.getTime())) {
    throw new ContractException(
      "Product snapshot snapshotAt must be a valid date",
    );
  }

  // Products and contracts never expire - v2.16.13
  // Removed validityDays validation

  return true;
}

/**
 * Validate product snapshot matches authoritative product data
 * [验证产品快照与权威产品数据匹配]
 * @param snapshot Product snapshot to validate
 * @param productId Product ID from database
 * @param productPrice Product price from database
 * @param productCurrency Product currency from database
 * @returns True if valid, throws ContractException otherwise
 */
export function validateProductSnapshotMatch(
  snapshot: unknown,
  productId: string,
  productPrice: string | number,
  productCurrency: string,
): boolean {
  if (!snapshot || typeof snapshot !== "object") {
    throw new ContractException("Product snapshot must be an object");
  }

  const snap = snapshot as Record<string, unknown>;

  // Validate productId matches [验证产品ID匹配]
  if (snap.productId !== productId) {
    throw new ContractException(
      "SNAPSHOT_MISMATCH",
      "Product snapshot productId does not match",
    );
  }

  // Validate price matches [验证价格匹配]
  const snapshotPrice =
    typeof snap.price === "string" ? snap.price : String(snap.price);
  const dbPrice =
    typeof productPrice === "string" ? productPrice : String(productPrice);
  if (snapshotPrice !== dbPrice) {
    throw new ContractException(
      "SNAPSHOT_MISMATCH",
      `Product price mismatch. Provided: ${snapshotPrice}, Actual: ${dbPrice}`,
    );
  }

  // Validate currency matches [验证货币匹配]
  if (snap.currency !== productCurrency) {
    throw new ContractException(
      "SNAPSHOT_MISMATCH",
      `Product currency mismatch. Provided: ${snap.currency}, Actual: ${productCurrency}`,
    );
  }

  return true;
}
