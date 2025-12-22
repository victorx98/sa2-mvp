import { describe, it, expect } from '@jest/globals';
import { ServiceHold } from '../service-hold.entity';
import {
  InvalidHoldQuantityException,
  HoldNotActiveException,
  HoldCannotExpireException,
} from '../service-hold.entity';

describe('ServiceHold Entity', () => {
  const contractId = 'contract-123';
  const studentId = 'student-456';
  const serviceType = 'ONE_ON_ONE';
  const createdBy = 'user-789';

  describe('create', () => {
    it('should create a valid hold with minimal parameters', () => {
      const quantity = 2;

      const hold = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        quantity,
        createdBy,
      );

      expect(hold.getContractId()).toBe(contractId);
      expect(hold.getStudentId()).toBe(studentId);
      expect(hold.getServiceType()).toBe(serviceType);
      expect(hold.getQuantity()).toBe(quantity);
      expect(hold.isActive()).toBe(true);
      expect(hold.isFinalized()).toBe(false);
    });

    it('should create a hold with related booking ID', () => {
      const quantity = 1;
      const relatedBookingId = 'booking-abc';

      const hold = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        quantity,
        createdBy,
        { relatedBookingId },
      );

      expect(hold.getRelatedBookingId()).toBe(relatedBookingId);
    });

    it('should create a hold with expiry time', () => {
      const quantity = 1;
      const expiryAt = new Date(Date.now() + 3600000); // 1 hour from now

      const hold = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        quantity,
        createdBy,
        { expiryAt },
      );

      expect(hold.getExpiryAt()).toBe(expiryAt);
    });

    it('should throw InvalidHoldQuantityException for non-positive quantity', () => {
      expect(() =>
        ServiceHold.create(contractId, studentId, serviceType, 0, createdBy),
      ).toThrow(InvalidHoldQuantityException);

      expect(() =>
        ServiceHold.create(contractId, studentId, serviceType, -1, createdBy),
      ).toThrow(InvalidHoldQuantityException);
    });
  });

  describe('release', () => {
    it('should successfully release an active hold', () => {
      const hold = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        1,
        createdBy,
      );

      const releaseReason = 'Service completed';
      hold.release(releaseReason, 'admin-1');

      expect(hold.isReleased()).toBe(true);
      expect(hold.isActive()).toBe(false);
      expect(hold.getReleasedAt()).toBeInstanceOf(Date);
      expect(hold.getReleaseReason()).toBe(releaseReason);
    });

    it('should throw HoldNotActiveException when releasing a released hold', () => {
      const hold = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        1,
        createdBy,
      );

      hold.release('completed', 'admin-1');

      expect(() =>
        hold.release('completed again', 'admin-1'),
      ).toThrow(HoldNotActiveException);
    });

    it('should throw HoldNotActiveException when releasing a cancelled hold', () => {
      const hold = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        1,
        createdBy,
      );

      hold.cancel('user cancelled', 'user-1');

      expect(() =>
        hold.release('completed', 'admin-1'),
      ).toThrow(HoldNotActiveException);
    });
  });

  describe('cancel', () => {
    it('should successfully cancel an active hold', () => {
      const hold = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        1,
        createdBy,
      );

      const cancelReason = 'User cancelled booking';
      hold.cancel(cancelReason, 'user-1');

      expect(hold.isCancelled()).toBe(true);
      expect(hold.isActive()).toBe(false);
      expect(hold.getReleasedAt()).toBeInstanceOf(Date);
      expect(hold.getReleaseReason()).toBe(cancelReason);
    });

    it('should throw HoldNotActiveException when cancelling a released hold', () => {
      const hold = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        1,
        createdBy,
      );

      hold.release('completed', 'admin-1');

      expect(() =>
        hold.cancel('user cancelled', 'user-1'),
      ).toThrow(HoldNotActiveException);
    });

    it('should throw HoldNotActiveException when cancelling a cancelled hold', () => {
      const hold = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        1,
        createdBy,
      );

      hold.cancel('user cancelled', 'user-1');

      expect(() =>
        hold.cancel('cancel again', 'user-1'),
      ).toThrow(HoldNotActiveException);
    });
  });

  describe('markAsExpired', () => {
    it('should successfully mark an expired hold as expired', () => {
      const expiryAt = new Date(Date.now() - 1000); // 1 second in the past
      const hold = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        1,
        createdBy,
        { expiryAt },
      );

      hold.markAsExpired();

      expect(hold.isExpired()).toBe(true);
      expect(hold.isActive()).toBe(false);
      expect(hold.getReleasedAt()).toBeInstanceOf(Date);
      expect(hold.getReleaseReason()).toBe('expired');
    });

    it('should throw HoldNotActiveException when marking a released hold as expired', () => {
      const expiryAt = new Date(Date.now() - 1000);
      const hold = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        1,
        createdBy,
        { expiryAt },
      );

      hold.release('completed', 'admin-1');

      expect(() => hold.markAsExpired()).toThrow(HoldNotActiveException);
    });

    it('should throw HoldCannotExpireException when hold does not have expiry time', () => {
      const hold = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        1,
        createdBy,
      );

      expect(() => hold.markAsExpired()).toThrow(HoldCannotExpireException);
    });

    it('should throw HoldCannotExpireException when expiry time is in the future', () => {
      const expiryAt = new Date(Date.now() + 3600000); // 1 hour in the future
      const hold = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        1,
        createdBy,
        { expiryAt },
      );

      expect(() => hold.markAsExpired()).toThrow(HoldCannotExpireException);
    });
  });

  describe('getters', () => {
    it('should return all properties correctly', () => {
      const quantity = 3;
      const relatedBookingId = 'booking-abc';
      const expiryAt = new Date(Date.now() + 3600000);

      const hold = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        quantity,
        createdBy,
        { relatedBookingId, expiryAt },
      );

      expect(hold.getId()).toBeDefined();
      expect(hold.getContractId()).toBe(contractId);
      expect(hold.getStudentId()).toBe(studentId);
      expect(hold.getServiceType()).toBe(serviceType);
      expect(hold.getQuantity()).toBe(quantity);
      expect(hold.getRelatedBookingId()).toBe(relatedBookingId);
      expect(hold.getExpiryAt()).toBe(expiryAt);
      expect(hold.getCreatedAt()).toBeInstanceOf(Date);
      expect(hold.getUpdatedAt()).toBeInstanceOf(Date);
      expect(hold.getCreatedBy()).toBe(createdBy);
    });
  });

  describe('reconstruct', () => {
    it('should reconstruct ServiceHold from props', () => {
      const original = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        2,
        createdBy,
        { relatedBookingId: 'booking-123' },
      );

      const props = {
        id: original.getId(),
        contractId: original.getContractId(),
        studentId: original.getStudentId(),
        serviceType: original.getServiceType(),
        quantity: original.getQuantity(),
        status: original.getStatus(),
        relatedBookingId: original.getRelatedBookingId(),
        expiryAt: original.getExpiryAt(),
        releasedAt: original.getReleasedAt(),
        releaseReason: original.getReleaseReason(),
        createdAt: original.getCreatedAt(),
        updatedAt: original.getUpdatedAt(),
        createdBy: original.getCreatedBy(),
      };

      const reconstructed = ServiceHold.reconstruct(props);

      expect(reconstructed.getId()).toBe(original.getId());
      expect(reconstructed.getContractId()).toBe(original.getContractId());
      expect(reconstructed.getStudentId()).toBe(original.getStudentId());
      expect(reconstructed.getServiceType()).toBe(original.getServiceType());
      expect(reconstructed.getQuantity()).toBe(original.getQuantity());
      expect(reconstructed.isActive()).toBe(original.isActive());
    });
  });

  describe('state check methods', () => {
    it('should correctly check if hold is finalized', () => {
      const hold = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        1,
        createdBy,
      );

      expect(hold.isFinalized()).toBe(false);

      hold.release('completed', 'admin-1');
      expect(hold.isFinalized()).toBe(true);
      expect(hold.isReleased()).toBe(true);
    });

    it('should correctly check if hold has expired', () => {
      const pastExpiry = new Date(Date.now() - 1000);
      const hold = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        1,
        createdBy,
        { expiryAt: pastExpiry },
      );

      expect(hold.hasExpired()).toBe(true);

      const futureExpiry = new Date(Date.now() + 3600000);
      const hold2 = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        1,
        createdBy,
        { expiryAt: futureExpiry },
      );

      expect(hold2.hasExpired()).toBe(false);

      const hold3 = ServiceHold.create(
        contractId,
        studentId,
        serviceType,
        1,
        createdBy,
      );

      expect(hold3.hasExpired()).toBe(false);
    });
  });
});
