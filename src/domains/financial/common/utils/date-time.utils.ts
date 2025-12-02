/**
 * Date/Time utility functions for Financial Domain
 * [Financial域日期时间工具函数]
 *
 * All dates are handled in UTC to ensure consistency across different timezones.
 * [所有日期使用UTC处理，确保不同时区的一致性]
 */

/**
 * Parse date string to UTC Date object
 * [将日期字符串解析为UTC Date对象]
 * @param dateString - Date string in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)
 * @returns UTC Date object
 * @throws Error if date string is invalid
 */
export function parseDateToUTC(dateString: string): Date {
  if (!dateString || typeof dateString !== "string") {
    throw new Error("Invalid date string: must be a non-empty string");
  }

  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateString}. Expected ISO 8601 format.`);
  }

  return date;
}

/**
 * Get current datetime in UTC
 * [获取当前UTC日期时间]
 * @returns Current UTC Date object
 */
export function getCurrentUTC(): Date {
  return new Date();
}

/**
 * Format date as ISO string in UTC
 * [将日期格式化为ISO字符串（UTC）]
 * @param date - Date object
 * @returns ISO 8601 string in UTC (YYYY-MM-DDTHH:mm:ss.sssZ)
 */
export function formatDateToISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Get start of day in UTC
 * [获取UTC日期的开始时间]
 * @param dateString - Date string
 * @returns UTC Date object at 00:00:00.000Z
 */
export function getStartOfDayUTC(dateString: string): Date {
  const date = parseDateToUTC(dateString);
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ));
}

/**
 * Get end of day in UTC
 * [获取UTC日期的结束时间]
 * @param dateString - Date string
 * @returns UTC Date object at 23:59:59.999Z
 */
export function getEndOfDayUTC(dateString: string): Date {
  const date = parseDateToUTC(dateString);
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    23, 59, 59, 999
  ));
}

/**
 * Validate ISO 8601 date string format
 * [验证ISO 8601日期字符串格式]
 * @param dateString - Date string to validate
 * @returns True if valid, false otherwise
 */
export function isValidISODateString(dateString: string): boolean {
  if (!dateString || typeof dateString !== "string") {
    return false;
  }

  const isoRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  if (!isoRegex.test(dateString)) {
    return false;
  }

  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Convert any date to UTC
 * [将任意日期转换为UTC]
 * @param date - Date object or timestamp
 * @returns UTC Date object
 */
export function toUTC(date: Date | number | string): Date {
  if (date instanceof Date) {
    return new Date(date.toISOString());
  }
  return new Date(new Date(date).toISOString());
}

/**
 * Calculate date range in UTC
 * [计算UTC日期范围]
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Object with start and end UTC dates
 * @throws Error if dates are invalid or start > end
 */
export function calculateDateRangeUTC(
  startDate: string,
  endDate: string,
): { start: Date; end: Date } {
  if (!isValidISODateString(startDate)) {
    throw new Error(`Invalid start date format: ${startDate}`);
  }
  if (!isValidISODateString(endDate)) {
    throw new Error(`Invalid end date format: ${endDate}`);
  }

  const start = parseDateToUTC(startDate);
  const end = parseDateToUTC(endDate);

  if (start.getTime() > end.getTime()) {
    throw new Error("Start date cannot be after end date");
  }

  return { start, end };
}
