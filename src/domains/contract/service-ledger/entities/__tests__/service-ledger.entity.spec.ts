import { describe, it, expect } from '@jest/globals';
import { ServiceLedger } from '../service-ledger.entity';
import {
  InsufficientBalanceException,
  InvalidConsumptionQuantityException,
  InvalidRefundQuantityException,
  InvalidAdjustmentException,
} from '../service-ledger.entity';

describe('ServiceLedger Entity', () => {
  const studentId = 'student-123';
  const serviceType = 'ONE_ON_ONE';
  const createdBy = 'user-456';

  describe('recordConsumption', () => {
    it('should create a valid consumption entry', () => {
      const currentBalance = 10;
      const quantity = 3;

      const ledger = ServiceLedger.recordConsumption(
        studentId,
        serviceType,
        quantity,
        currentBalance,
        createdBy,
      );

      expect(ledger.getStudentId()).toBe(studentId);
      expect(ledger.getServiceType()).toBe(serviceType);
      expect(ledger.getQuantity()).toBe(-quantity);
      expect(ledger.isConsumption()).toBe(true);
      expect(ledger.isRefund()).toBe(false);
      expect(ledger.isAdjustment()).toBe(false);
      expect(ledger.getBalanceAfter()).toBe(currentBalance - quantity);
    });

    it('should create consumption entry with optional parameters', () => {
      const currentBalance = 10;
      const quantity = 3;
      const relatedBookingId = 'booking-789';
      const bookingSource = 'regular_mentoring_sessions';

      const ledger = ServiceLedger.recordConsumption(
        studentId,
        serviceType,
        quantity,
        currentBalance,
        createdBy,
        {
          relatedBookingId,
          bookingSource,
        },
      );

      expect(ledger.getRelatedBookingId()).toBe(relatedBookingId);
      expect(ledger.getMetadata().bookingSource).toBe(bookingSource);
    });

    it('should throw InvalidConsumptionQuantityException for non-positive quantity', () => {
      expect(() =>
        ServiceLedger.recordConsumption(studentId, serviceType, 0, 10, createdBy),
      ).toThrow(InvalidConsumptionQuantityException);

      expect(() =>
        ServiceLedger.recordConsumption(studentId, serviceType, -1, 10, createdBy),
      ).toThrow(InvalidConsumptionQuantityException);
    });

    it('should throw InsufficientBalanceException when balance is insufficient', () => {
      const currentBalance = 5;
      const quantity = 10;

      expect(() =>
        ServiceLedger.recordConsumption(studentId, serviceType, quantity, currentBalance, createdBy),
      ).toThrow(InsufficientBalanceException);
      expect(() =>
        ServiceLedger.recordConsumption(studentId, serviceType, quantity, currentBalance, createdBy),
      ).toThrow(/Insufficient balance.*student-123.*ONE_ON_ONE/);
    });
  });

  describe('recordRefund', () => {
    it('should create a valid refund entry', () => {
      const currentBalance = 5;
      const quantity = 3;
      const relatedBookingId = 'booking-789';
      const bookingSource = 'resumes';

      const ledger = ServiceLedger.recordRefund(
        studentId,
        serviceType,
        quantity,
        currentBalance,
        createdBy,
        relatedBookingId,
        bookingSource,
      );

      expect(ledger.getStudentId()).toBe(studentId);
      expect(ledger.getServiceType()).toBe(serviceType);
      expect(ledger.getQuantity()).toBe(quantity);
      expect(ledger.isRefund()).toBe(true);
      expect(ledger.isConsumption()).toBe(false);
      expect(ledger.isAdjustment()).toBe(false);
      expect(ledger.getBalanceAfter()).toBe(currentBalance + quantity);
      expect(ledger.getRelatedBookingId()).toBe(relatedBookingId);
      expect(ledger.getMetadata().bookingSource).toBe(bookingSource);
    });

    it('should throw InvalidRefundQuantityException for non-positive quantity', () => {
      expect(() =>
        ServiceLedger.recordRefund(studentId, serviceType, 0, 10, createdBy, 'booking-1', 'resumes'),
      ).toThrow(InvalidRefundQuantityException);

      expect(() =>
        ServiceLedger.recordRefund(studentId, serviceType, -1, 10, createdBy, 'booking-1', 'resumes'),
      ).toThrow(InvalidRefundQuantityException);
    });
  });

  describe('recordAdjustment', () => {
    it('should create a valid positive adjustment', () => {
      const currentBalance = 5;
      const quantity = 5;
      const reason = 'Compensation for service issue';

      const ledger = ServiceLedger.recordAdjustment(
        studentId,
        serviceType,
        quantity,
        currentBalance,
        reason,
        createdBy,
      );

      expect(ledger.getStudentId()).toBe(studentId);
      expect(ledger.getServiceType()).toBe(serviceType);
      expect(ledger.getQuantity()).toBe(quantity);
      expect(ledger.isAdjustment()).toBe(true);
      expect(ledger.isConsumption()).toBe(false);
      expect(ledger.isRefund()).toBe(false);
      expect(ledger.getBalanceAfter()).toBe(currentBalance + quantity);
      expect(ledger.getReason()).toBe(reason);
    });

    it('should create a valid negative adjustment', () => {
      const currentBalance = 10;
      const quantity = -3;
      const reason = 'Correction of over-allocated services';

      const ledger = ServiceLedger.recordAdjustment(
        studentId,
        serviceType,
        quantity,
        currentBalance,
        reason,
        createdBy,
      );

      expect(ledger.getQuantity()).toBe(quantity);
      expect(ledger.getBalanceAfter()).toBe(currentBalance + quantity);
      expect(ledger.getReason()).toBe(reason);
    });

    it('should throw InvalidAdjustmentException when resulting balance is negative', () => {
      const currentBalance = 3;
      const quantity = -5;
      const reason = 'Too much reduction';

      expect(() =>
        ServiceLedger.recordAdjustment(studentId, serviceType, quantity, currentBalance, reason, createdBy),
      ).toThrow(InvalidAdjustmentException);
      expect(() =>
        ServiceLedger.recordAdjustment(studentId, serviceType, quantity, currentBalance, reason, createdBy),
      ).toThrow(/negative balance.*-2/);
    });

    it('should throw InvalidAdjustmentException when reason is missing or empty', () => {
      expect(() =>
        ServiceLedger.recordAdjustment(studentId, serviceType, 5, 10, '', createdBy),
      ).toThrow(InvalidAdjustmentException);

      expect(() =>
        ServiceLedger.recordAdjustment(studentId, serviceType, 5, 10, '   ', createdBy),
      ).toThrow(InvalidAdjustmentException);

      expect(() =>
        ServiceLedger.recordAdjustment(studentId, serviceType, 5, 10, '', createdBy),
      ).toThrow(/Reason is required for adjustments/);
    });
  });

  describe('reconstruct', () => {
    it('should reconstruct ServiceLedger from props', () => {
      const original = ServiceLedger.recordConsumption(studentId, serviceType, 3, 10, createdBy);
      const props = {
        id: original.getId(),
        studentId: original.getStudentId(),
        serviceType: original.getServiceType(),
        quantity: original.getQuantity(),
        type: original.getType(),
        source: original.getSource(),
        balanceAfter: original.getBalanceAfter(),
        createdAt: original.getCreatedAt(),
        createdBy: original.getCreatedBy(),
        metadata: original.getMetadata(),
      };

      const reconstructed = ServiceLedger.reconstruct(props);

      expect(reconstructed.getId()).toBe(original.getId());
      expect(reconstructed.getStudentId()).toBe(original.getStudentId());
      expect(reconstructed.getServiceType()).toBe(original.getServiceType());
      expect(reconstructed.getQuantity()).toBe(original.getQuantity());
      expect(reconstructed.isConsumption()).toBe(original.isConsumption());
      expect(reconstructed.getBalanceAfter()).toBe(original.getBalanceAfter());
    });
  });

  describe('getters', () => {
    it('should return all properties correctly', () => {
      const currentBalance = 10;
      const quantity = 3;
      const relatedHoldId = 'hold-123';

      const ledger = ServiceLedger.recordConsumption(
        studentId,
        serviceType,
        quantity,
        currentBalance,
        createdBy,
        { relatedHoldId },
      );

      expect(ledger.getId()).toBeDefined();
      expect(ledger.getStudentId()).toBe(studentId);
      expect(ledger.getServiceType()).toBe(serviceType);
      expect(ledger.getQuantity()).toBe(-quantity);
      expect(ledger.getBalanceAfter()).toBe(currentBalance - quantity);
      expect(ledger.getRelatedHoldId()).toBe(relatedHoldId);
      expect(ledger.getCreatedAt()).toBeInstanceOf(Date);
      expect(ledger.getCreatedBy()).toBe(createdBy);
    });
  });
});
