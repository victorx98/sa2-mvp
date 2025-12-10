import {
  parseDateToUTC,
  getCurrentUTC,
  formatDateToISOString,
  getStartOfDayUTC,
  getEndOfDayUTC,
  isValidISODateString,
  toUTC,
  calculateDateRangeUTC,
} from "./date-time.utils";

describe("Date-Time Utils", () => {
  describe("parseDateToUTC", () => {
    it("should parse valid ISO date string", () => {
      const date = parseDateToUTC("2024-01-15");
      expect(date).toBeInstanceOf(Date);
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(0);
      expect(date.getUTCDate()).toBe(15);
    });

    it("should parse valid ISO datetime string", () => {
      const date = parseDateToUTC("2024-01-15T10:30:00.000Z");
      expect(date).toBeInstanceOf(Date);
    });

    it("should throw error for invalid date string", () => {
      expect(() => parseDateToUTC("invalid-date")).toThrow();
    });

    it("should throw error for empty string", () => {
      expect(() => parseDateToUTC("")).toThrow();
    });

    it("should throw error for null", () => {
      expect(() => parseDateToUTC(null as unknown as string)).toThrow();
    });

    it("should throw error for undefined", () => {
      expect(() => parseDateToUTC(undefined as unknown as string)).toThrow();
    });
  });

  describe("getCurrentUTC", () => {
    it("should return current UTC date", () => {
      const date = getCurrentUTC();
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("formatDateToISOString", () => {
    it("should format date to ISO string", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      const isoString = formatDateToISOString(date);
      expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("getStartOfDayUTC", () => {
    it("should return start of day in UTC", () => {
      const date = getStartOfDayUTC("2024-01-15");
      expect(date.getUTCHours()).toBe(0);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
      expect(date.getUTCMilliseconds()).toBe(0);
    });

    it("should throw error for invalid date", () => {
      expect(() => getStartOfDayUTC("invalid-date")).toThrow();
    });
  });

  describe("getEndOfDayUTC", () => {
    it("should return end of day in UTC", () => {
      const date = getEndOfDayUTC("2024-01-15");
      expect(date.getUTCHours()).toBe(23);
      expect(date.getUTCMinutes()).toBe(59);
      expect(date.getUTCSeconds()).toBe(59);
      expect(date.getUTCMilliseconds()).toBe(999);
    });

    it("should throw error for invalid date", () => {
      expect(() => getEndOfDayUTC("invalid-date")).toThrow();
    });
  });

  describe("isValidISODateString", () => {
    it("should return true for valid ISO date string", () => {
      expect(isValidISODateString("2024-01-15")).toBe(true);
      expect(isValidISODateString("2024-01-15T10:30:00Z")).toBe(true);
      expect(isValidISODateString("2024-01-15T10:30:00.000Z")).toBe(true);
    });

    it("should return false for invalid date string", () => {
      expect(isValidISODateString("invalid-date")).toBe(false);
      expect(isValidISODateString("2024/01/15")).toBe(false);
      expect(isValidISODateString("")).toBe(false);
    });

    it("should return false for null", () => {
      expect(isValidISODateString(null as unknown as string)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isValidISODateString(undefined as unknown as string)).toBe(false);
    });

    it("should return false for non-string", () => {
      expect(isValidISODateString(123 as unknown as string)).toBe(false);
    });
  });

  describe("toUTC", () => {
    it("should convert Date to UTC", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      const utcDate = toUTC(date);
      expect(utcDate).toBeInstanceOf(Date);
    });

    it("should convert timestamp to UTC", () => {
      const timestamp = Date.now();
      const utcDate = toUTC(timestamp);
      expect(utcDate).toBeInstanceOf(Date);
    });

    it("should convert string to UTC", () => {
      const dateString = "2024-01-15T10:30:00Z";
      const utcDate = toUTC(dateString);
      expect(utcDate).toBeInstanceOf(Date);
    });
  });

  describe("calculateDateRangeUTC", () => {
    it("should calculate valid date range", () => {
      const range = calculateDateRangeUTC("2024-01-01", "2024-01-31");
      expect(range.start).toBeInstanceOf(Date);
      expect(range.end).toBeInstanceOf(Date);
      expect(range.start.getTime()).toBeLessThanOrEqual(range.end.getTime());
    });

    it("should throw error for invalid start date", () => {
      expect(() =>
        calculateDateRangeUTC("invalid-date", "2024-01-31"),
      ).toThrow();
    });

    it("should throw error for invalid end date", () => {
      expect(() =>
        calculateDateRangeUTC("2024-01-01", "invalid-date"),
      ).toThrow();
    });

    it("should throw error when start date is after end date", () => {
      expect(() =>
        calculateDateRangeUTC("2024-01-31", "2024-01-01"),
      ).toThrow("Start date cannot be after end date");
    });
  });
});


