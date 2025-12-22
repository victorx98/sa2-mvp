import { describe, it, expect } from '@jest/globals';
import { LedgerType, InvalidLedgerTypeException } from '../ledger-type.vo';

describe('LedgerType Value Object', () => {
  describe('fromString', () => {
    it('should create CONSUMPTION type', () => {
      const type = LedgerType.fromString('consumption');
      expect(type.isConsumption()).toBe(true);
      expect(type.getValue()).toBe('consumption');
    });

    it('should create REFUND type', () => {
      const type = LedgerType.fromString('refund');
      expect(type.isRefund()).toBe(true);
      expect(type.getValue()).toBe('refund');
    });

    it('should create ADJUSTMENT type', () => {
      const type = LedgerType.fromString('adjustment');
      expect(type.isAdjustment()).toBe(true);
      expect(type.getValue()).toBe('adjustment');
    });

    it('should handle case-insensitive input', () => {
      expect(LedgerType.fromString('CONSUMPTION').isConsumption()).toBe(true);
      expect(LedgerType.fromString('Consumption').isConsumption()).toBe(true);
      expect(LedgerType.fromString('Refund').isRefund()).toBe(true);
      expect(LedgerType.fromString('ADJUSTMENT').isAdjustment()).toBe(true);
    });

    it('should throw InvalidLedgerTypeException for invalid type', () => {
      expect(() => LedgerType.fromString('invalid')).toThrow(InvalidLedgerTypeException);
    });
  });

  describe('type query methods', () => {
    it('should correctly identify each type', () => {
      expect(LedgerType.CONSUMPTION.isConsumption()).toBe(true);
      expect(LedgerType.CONSUMPTION.isRefund()).toBe(false);
      expect(LedgerType.CONSUMPTION.isAdjustment()).toBe(false);

      expect(LedgerType.REFUND.isRefund()).toBe(true);
      expect(LedgerType.REFUND.isConsumption()).toBe(false);
      expect(LedgerType.REFUND.isAdjustment()).toBe(false);

      expect(LedgerType.ADJUSTMENT.isAdjustment()).toBe(true);
      expect(LedgerType.ADJUSTMENT.isConsumption()).toBe(false);
      expect(LedgerType.ADJUSTMENT.isRefund()).toBe(false);
    });
  });

  describe('reconstruct', () => {
    it('should reconstruct from valid type string', () => {
      const type = LedgerType.reconstruct('consumption');
      expect(type.isConsumption()).toBe(true);
      expect(type.getValue()).toBe('consumption');
    });
  });

  describe('equality', () => {
    it('should return true for same type instances', () => {
      const type1 = LedgerType.fromString('consumption');
      const type2 = LedgerType.fromString('consumption');
      expect(type1.equals(type2)).toBe(true);
    });

    it('should return false for different types', () => {
      const consumption = LedgerType.CONSUMPTION;
      const refund = LedgerType.REFUND;
      expect(consumption.equals(refund)).toBe(false);
    });

    it('should work with reconstruct', () => {
      const original = LedgerType.CONSUMPTION;
      const reconstructed = LedgerType.reconstruct('consumption');
      expect(original.equals(reconstructed)).toBe(true);
    });
  });

  describe('getValue', () => {
    it('should return correct value for each type', () => {
      expect(LedgerType.CONSUMPTION.getValue()).toBe('consumption');
      expect(LedgerType.REFUND.getValue()).toBe('refund');
      expect(LedgerType.ADJUSTMENT.getValue()).toBe('adjustment');
    });
  });
});
