/**
 * Date utility functions for Contract Domain
 */

import { ARCHIVE_MAX_DATE_RANGE_DAYS } from "../constants/contract.constants";

/**
 * Calculate contract expiration date
 * @param signedAt Contract signing date
 * @param validityDays Validity period in days (null = permanent)
 * @returns Expiration date or null for permanent contracts
 */
export function calculateExpirationDate(
  signedAt: Date,
  validityDays: number | null,
): Date | null {
  if (validityDays === null || validityDays === undefined) {
    return null; // Permanent contract
  }

  const expiresAt = new Date(signedAt);
  expiresAt.setDate(expiresAt.getDate() + validityDays);
  return expiresAt;
}

/**
 * Calculate hold expiration date
 * @param createdAt Hold creation date
 * @param ttlMinutes TTL in minutes
 * @returns Hold expiration date
 * @deprecated v2.16.9: Hold TTL mechanism removed. Holds no longer expire automatically.
 */
export function calculateHoldExpirationDate(
  createdAt: Date = new Date(),
  ttlMinutes: number = 15, // Default value removed dependency on HOLD_TTL_MINUTES
): Date {
  const expiresAt = new Date(createdAt);
  expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);
  return expiresAt;
}

/**
 * Check if contract has expired
 * @param expiresAt Expiration date
 * @returns True if expired, false otherwise
 */
export function isContractExpired(expiresAt: Date | null): boolean {
  if (expiresAt === null) {
    return false; // Permanent contracts never expire
  }
  return new Date() > expiresAt;
}

/**
 * Check if hold has expired
 * @param expiresAt Hold expiration date
 * @returns True if expired, false otherwise
 * @deprecated v2.16.9: Hold TTL mechanism removed. Holds no longer expire automatically.
 */
export function isHoldExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Calculate archive cutoff date
 * @param archiveAfterDays Days after which to archive
 * @returns Cutoff date
 */
export function calculateArchiveCutoffDate(archiveAfterDays: number): Date {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - archiveAfterDays);
  return cutoffDate;
}

/**
 * Validate date range for archive queries
 * @param startDate Start date
 * @param endDate End date
 * @returns True if valid, throws error otherwise
 */
export function validateArchiveDateRange(
  startDate: Date,
  endDate: Date,
): boolean {
  if (startDate > endDate) {
    throw new Error("Start date must be before end date");
  }

  const daysDiff = Math.floor(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysDiff > ARCHIVE_MAX_DATE_RANGE_DAYS) {
    throw new Error(
      `Date range cannot exceed ${ARCHIVE_MAX_DATE_RANGE_DAYS} days`,
    );
  }

  return true;
}

/**
 * Format contract number
 * @param year Year
 * @param month Month (1-12)
 * @param sequence Sequence number
 * @returns Formatted contract number (e.g., 'CONTRACT-2025-11-00001')
 */
export function formatContractNumber(
  year: number,
  month: number,
  sequence: number,
): string {
  const paddedMonth = month.toString().padStart(2, "0");
  const paddedSequence = sequence.toString().padStart(5, "0");
  return `CONTRACT-${year}-${paddedMonth}-${paddedSequence}`;
}

/**
 * Parse contract number
 * @param contractNumber Contract number string
 * @returns Parsed components or null if invalid
 */
export function parseContractNumber(contractNumber: string): {
  year: number;
  month: number;
  sequence: number;
} | null {
  const regex = /^CONTRACT-(\d{4})-(\d{2})-(\d{5})$/;
  const match = contractNumber.match(regex);

  if (!match) {
    return null;
  }

  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    sequence: parseInt(match[3], 10),
  };
}

/**
 * Get current month key for advisory lock
 * @returns Month key in YYYYMM format (e.g., 202511)
 */
export function getCurrentMonthKey(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 0-based to 1-based
  return year * 100 + month;
}

/**
 * Add days to date
 * @param date Base date
 * @param days Number of days to add
 * @returns New date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add minutes to date
 * @param date Base date
 * @param minutes Number of minutes to add
 * @returns New date
 */
export function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

/**
 * Check if date is in the past
 * @param date Date to check
 * @returns True if date is in the past
 */
export function isPast(date: Date): boolean {
  return date < new Date();
}

/**
 * Check if date is in the future
 * @param date Date to check
 * @returns True if date is in the future
 */
export function isFuture(date: Date): boolean {
  return date > new Date();
}

/**
 * Get start of day
 * @param date Date
 * @returns Start of day (00:00:00)
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day
 * @param date Date
 * @returns End of day (23:59:59.999)
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}
