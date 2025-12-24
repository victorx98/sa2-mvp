import {
  validateMentorPrice,
  validateCurrency,
  validateStatus,
} from "./validation.utils";
import { FinancialException } from "../exceptions/financial.exception";

describe("Validation Utils", () => {
  describe("validateMentorPrice", () => {
    it("should validate positive price", () => {
      expect(() => validateMentorPrice(100)).not.toThrow();
      expect(() => validateMentorPrice(100.5)).not.toThrow();
      expect(() => validateMentorPrice(0.1)).not.toThrow();
    });

    it("should throw error for zero price", () => {
      expect(() => validateMentorPrice(0)).toThrow(FinancialException);
    });

    it("should throw error for negative price", () => {
      expect(() => validateMentorPrice(-100)).toThrow(FinancialException);
    });

    it("should throw error for price with more than 1 decimal place", () => {
      expect(() => validateMentorPrice(100.12)).toThrow(FinancialException);
      expect(() => validateMentorPrice(100.123)).toThrow(FinancialException);
    });

    it("should throw error for price exceeding 12 digits", () => {
      expect(() => validateMentorPrice(1234567890123)).toThrow(
        FinancialException,
      );
    });

    it("should allow price with exactly 12 digits", () => {
      expect(() => validateMentorPrice(123456789012)).not.toThrow();
    });

    it("should allow price with 1 decimal place", () => {
      expect(() => validateMentorPrice(100.1)).not.toThrow();
    });
  });

  describe("validateCurrency", () => {
    it("should validate valid currency code", () => {
      expect(() => validateCurrency("USD")).not.toThrow();
      expect(() => validateCurrency("CNY")).not.toThrow();
      expect(() => validateCurrency("EUR")).not.toThrow();
    });

    it("should throw error for empty string", () => {
      expect(() => validateCurrency("")).toThrow(FinancialException);
    });

    it("should throw error for currency code with wrong length", () => {
      expect(() => validateCurrency("US")).toThrow(FinancialException);
      expect(() => validateCurrency("USDD")).toThrow(FinancialException);
    });

    it("should throw error for lowercase currency code", () => {
      expect(() => validateCurrency("usd")).toThrow(FinancialException);
    });

    it("should throw error for currency code with numbers", () => {
      expect(() => validateCurrency("US1")).toThrow(FinancialException);
    });
  });

  describe("validateStatus", () => {
    it("should validate active status", () => {
      expect(() => validateStatus("active")).not.toThrow();
    });

    it("should validate inactive status", () => {
      expect(() => validateStatus("inactive")).not.toThrow();
    });

    it("should throw error for invalid status", () => {
      expect(() => validateStatus("pending")).toThrow(FinancialException);
      expect(() => validateStatus("")).toThrow(FinancialException);
      expect(() => validateStatus("ACTIVE")).toThrow(FinancialException);
    });
  });
});


