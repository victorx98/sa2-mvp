import { describe, it, expect } from '@jest/globals';
import { Price, Currency, InvalidPriceException, CurrencyMismatchException } from '../price.vo';

describe('Price Value Object', () => {
  describe('create', () => {
    it('should create a valid price with number amount', () => {
      const price = Price.create(100, Currency.CNY);

      expect(price.getAmount()).toBe('100.00');
      expect(price.getCurrency()).toBe(Currency.CNY);
      expect(price.getNumericAmount()).toBe(100);
    });

    it('should create a valid price with string amount', () => {
      const price = Price.create('99.99', Currency.USD);

      expect(price.getAmount()).toBe('99.99');
      expect(price.getCurrency()).toBe(Currency.USD);
      expect(price.getNumericAmount()).toBe(99.99);
    });

    it('should reject zero price', () => {
      expect(() => Price.create(0, Currency.CNY)).toThrow(InvalidPriceException);
    });

    it('should reject negative price', () => {
      expect(() => Price.create(-10, Currency.CNY)).toThrow(InvalidPriceException);
    });

    it('should format string representation correctly', () => {
      const price = Price.create(100, Currency.CNY);

      expect(price.toString()).toBe('CNY 100.00');
    });
  });

  describe('add', () => {
    it('should add two prices with same currency', () => {
      const price1 = Price.create(100, Currency.CNY);
      const price2 = Price.create(50, Currency.CNY);
      const result = price1.add(price2);

      expect(result.getAmount()).toBe('150.00');
      expect(result.getCurrency()).toBe(Currency.CNY);
    });

    it('should throw CurrencyMismatchException for different currencies', () => {
      const price1 = Price.create(100, Currency.CNY);
      const price2 = Price.create(50, Currency.USD);

      expect(() => price1.add(price2)).toThrow(CurrencyMismatchException);
    });
  });

  describe('subtract', () => {
    it('should subtract two prices with same currency', () => {
      const price1 = Price.create(100, Currency.CNY);
      const price2 = Price.create(30, Currency.CNY);
      const result = price1.subtract(price2);

      expect(result.getAmount()).toBe('70.00');
      expect(result.getCurrency()).toBe(Currency.CNY);
    });

    it('should throw CurrencyMismatchException for different currencies', () => {
      const price1 = Price.create(100, Currency.CNY);
      const price2 = Price.create(30, Currency.USD);

      expect(() => price1.subtract(price2)).toThrow(CurrencyMismatchException);
    });
  });

  describe('multiply', () => {
    it('should multiply price by factor', () => {
      const price = Price.create(100, Currency.CNY);
      const result = price.multiply(0.5);

      expect(result.getAmount()).toBe('50.00');
      expect(result.getCurrency()).toBe(Currency.CNY);
    });

    it('should handle multiplication with decimal factor', () => {
      const price = Price.create(100, Currency.CNY);
      const result = price.multiply(0.06); // 6% tax

      expect(result.getAmount()).toBe('6.00');
      expect(result.getCurrency()).toBe(Currency.CNY);
    });
  });

  describe('isGreaterThan', () => {
    it('should return true when price is greater', () => {
      const price1 = Price.create(100, Currency.CNY);
      const price2 = Price.create(50, Currency.CNY);

      expect(price1.isGreaterThan(price2)).toBe(true);
    });

    it('should return false when price is not greater', () => {
      const price1 = Price.create(50, Currency.CNY);
      const price2 = Price.create(100, Currency.CNY);

      expect(price1.isGreaterThan(price2)).toBe(false);
    });

    it('should throw CurrencyMismatchException for different currencies', () => {
      const price1 = Price.create(100, Currency.CNY);
      const price2 = Price.create(50, Currency.USD);

      expect(() => price1.isGreaterThan(price2)).toThrow(CurrencyMismatchException);
    });
  });

  describe('isZero', () => {
    it('should return false for non-zero price', () => {
      const price = Price.create(100, Currency.CNY);

      expect(price.isZero()).toBe(false);
    });

    it('should handle precision correctly', () => {
      const price = Price.create(0.01, Currency.CNY);

      expect(price.isZero()).toBe(false);
    });
  });

  describe('equals', () => {
    it('should return true for identical prices', () => {
      const price1 = Price.create(100, Currency.CNY);
      const price2 = Price.create(100, Currency.CNY);

      expect(price1.equals(price2)).toBe(true);
    });

    it('should return false for different amounts', () => {
      const price1 = Price.create(100, Currency.CNY);
      const price2 = Price.create(50, Currency.CNY);

      expect(price1.equals(price2)).toBe(false);
    });

    it('should return false for different currencies', () => {
      const price1 = Price.create(100, Currency.CNY);
      const price2 = Price.create(100, Currency.USD);

      expect(price1.equals(price2)).toBe(false);
    });
  });
});
