import { describe, it, expect } from '@jest/globals';
import { LedgerSource, InvalidLedgerSourceException } from '../ledger-source.vo';

describe('LedgerSource Value Object', () => {
  describe('fromString', () => {
    it('should create BOOKING_COMPLETED source', () => {
      const source = LedgerSource.fromString('booking_completed');
      expect(source.isBookingCompleted()).toBe(true);
      expect(source.getValue()).toBe('booking_completed');
    });

    it('should create BOOKING_CANCELLED source', () => {
      const source = LedgerSource.fromString('booking_cancelled');
      expect(source.isBookingCancelled()).toBe(true);
      expect(source.getValue()).toBe('booking_cancelled');
    });

    it('should create MANUAL_ADJUSTMENT source', () => {
      const source = LedgerSource.fromString('manual_adjustment');
      expect(source.isManualAdjustment()).toBe(true);
      expect(source.getValue()).toBe('manual_adjustment');
    });

    it('should handle case-insensitive input', () => {
      expect(LedgerSource.fromString('BOOKING_COMPLETED').isBookingCompleted()).toBe(true);
      expect(LedgerSource.fromString('Booking_Completed').isBookingCompleted()).toBe(true);
      expect(LedgerSource.fromString('booking_cancelled').isBookingCancelled()).toBe(true);
      expect(LedgerSource.fromString('MANUAL_ADJUSTMENT').isManualAdjustment()).toBe(true);
    });

    it('should throw InvalidLedgerSourceException for invalid source', () => {
      expect(() => LedgerSource.fromString('invalid')).toThrow(InvalidLedgerSourceException);
    });
  });

  describe('source query methods', () => {
    it('should correctly identify each source', () => {
      expect(LedgerSource.BOOKING_COMPLETED.isBookingCompleted()).toBe(true);
      expect(LedgerSource.BOOKING_COMPLETED.isBookingCancelled()).toBe(false);
      expect(LedgerSource.BOOKING_COMPLETED.isManualAdjustment()).toBe(false);

      expect(LedgerSource.BOOKING_CANCELLED.isBookingCancelled()).toBe(true);
      expect(LedgerSource.BOOKING_CANCELLED.isBookingCompleted()).toBe(false);
      expect(LedgerSource.BOOKING_CANCELLED.isManualAdjustment()).toBe(false);

      expect(LedgerSource.MANUAL_ADJUSTMENT.isManualAdjustment()).toBe(true);
      expect(LedgerSource.MANUAL_ADJUSTMENT.isBookingCompleted()).toBe(false);
      expect(LedgerSource.MANUAL_ADJUSTMENT.isBookingCancelled()).toBe(false);
    });
  });

  describe('reconstruct', () => {
    it('should reconstruct from valid source string', () => {
      const source = LedgerSource.reconstruct('booking_completed');
      expect(source.isBookingCompleted()).toBe(true);
      expect(source.getValue()).toBe('booking_completed');
    });
  });

  describe('equality', () => {
    it('should return true for same source instances', () => {
      const source1 = LedgerSource.fromString('booking_completed');
      const source2 = LedgerSource.fromString('booking_completed');
      expect(source1.equals(source2)).toBe(true);
    });

    it('should return false for different sources', () => {
      const completed = LedgerSource.BOOKING_COMPLETED;
      const cancelled = LedgerSource.BOOKING_CANCELLED;
      expect(completed.equals(cancelled)).toBe(false);
    });

    it('should work with reconstruct', () => {
      const original = LedgerSource.BOOKING_COMPLETED;
      const reconstructed = LedgerSource.reconstruct('booking_completed');
      expect(original.equals(reconstructed)).toBe(true);
    });
  });

  describe('getValue and toString', () => {
    it('should return correct value for each source', () => {
      expect(LedgerSource.BOOKING_COMPLETED.getValue()).toBe('booking_completed');
      expect(LedgerSource.BOOKING_CANCELLED.getValue()).toBe('booking_cancelled');
      expect(LedgerSource.MANUAL_ADJUSTMENT.getValue()).toBe('manual_adjustment');
    });

    it('toString should return the source value', () => {
      expect(LedgerSource.BOOKING_COMPLETED.toString()).toBe('booking_completed');
    });
  });
});
