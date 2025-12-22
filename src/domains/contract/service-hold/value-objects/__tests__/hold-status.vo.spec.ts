import { describe, it, expect } from '@jest/globals';
import {
  HoldStatus,
  InvalidHoldStatusException,
  InvalidHoldStatusTransitionException,
} from '../hold-status.vo';

describe('HoldStatus Value Object', () => {
  describe('fromString', () => {
    it('should create ACTIVE status', () => {
      const status = HoldStatus.fromString('active');
      expect(status.isActive()).toBe(true);
      expect(status.getValue()).toBe('active');
    });

    it('should create RELEASED status', () => {
      const status = HoldStatus.fromString('released');
      expect(status.isReleased()).toBe(true);
      expect(status.getValue()).toBe('released');
    });

    it('should create CANCELLED status', () => {
      const status = HoldStatus.fromString('cancelled');
      expect(status.isCancelled()).toBe(true);
      expect(status.getValue()).toBe('cancelled');
    });

    it('should create EXPIRED status', () => {
      const status = HoldStatus.fromString('expired');
      expect(status.isExpired()).toBe(true);
      expect(status.getValue()).toBe('expired');
    });

    it('should handle case-insensitive input', () => {
      expect(HoldStatus.fromString('ACTIVE').isActive()).toBe(true);
      expect(HoldStatus.fromString('Active').isActive()).toBe(true);
      expect(HoldStatus.fromString('RELEASED').isReleased()).toBe(true);
      expect(HoldStatus.fromString('CANCELLED').isCancelled()).toBe(true);
      expect(HoldStatus.fromString('EXPIRED').isExpired()).toBe(true);
    });

    it('should throw InvalidHoldStatusException for invalid status', () => {
      expect(() => HoldStatus.fromString('invalid')).toThrow(InvalidHoldStatusException);
    });
  });

  describe('state transitions', () => {
    describe('ACTIVE → RELEASED/CANCELLED/EXPIRED', () => {
      it('should allow transition from ACTIVE to RELEASED', () => {
        const active = HoldStatus.ACTIVE;
        const released = active.transitionToReleased();

        expect(released.isReleased()).toBe(true);
      });

      it('should allow transition from ACTIVE to CANCELLED', () => {
        const active = HoldStatus.ACTIVE;
        const cancelled = active.transitionToCancelled();

        expect(cancelled.isCancelled()).toBe(true);
      });

      it('should allow transition from ACTIVE to EXPIRED', () => {
        const active = HoldStatus.ACTIVE;
        const expired = active.transitionToExpired();

        expect(expired.isExpired()).toBe(true);
      });

      it('should not allow transition from RELEASED to CANCELLED', () => {
        const released = HoldStatus.RELEASED;
        expect(() => released.transitionToCancelled()).toThrow(InvalidHoldStatusTransitionException);
      });

      it('should not allow transition from CANCELLED to RELEASED', () => {
        const cancelled = HoldStatus.CANCELLED;
        expect(() => cancelled.transitionToReleased()).toThrow(InvalidHoldStatusTransitionException);
      });

      it('should not allow transition from EXPIRED to RELEASED', () => {
        const expired = HoldStatus.EXPIRED;
        expect(() => expired.transitionToReleased()).toThrow(InvalidHoldStatusTransitionException);
      });
    });
  });

  describe('business rules', () => {
    describe('canBeReleased', () => {
      it('should return true for ACTIVE status', () => {
        expect(HoldStatus.ACTIVE.canBeReleased()).toBe(true);
      });

      it('should return false for non-ACTIVE statuses', () => {
        expect(HoldStatus.RELEASED.canBeReleased()).toBe(false);
        expect(HoldStatus.CANCELLED.canBeReleased()).toBe(false);
        expect(HoldStatus.EXPIRED.canBeReleased()).toBe(false);
      });
    });

    describe('canBeCancelled', () => {
      it('should return true for ACTIVE status', () => {
        expect(HoldStatus.ACTIVE.canBeCancelled()).toBe(true);
      });

      it('should return false for non-ACTIVE statuses', () => {
        expect(HoldStatus.RELEASED.canBeCancelled()).toBe(false);
        expect(HoldStatus.CANCELLED.canBeCancelled()).toBe(false);
        expect(HoldStatus.EXPIRED.canBeCancelled()).toBe(false);
      });
    });

    describe('canExpire', () => {
      it('should return true for ACTIVE status', () => {
        expect(HoldStatus.ACTIVE.canExpire()).toBe(true);
      });

      it('should return false for non-ACTIVE statuses', () => {
        expect(HoldStatus.RELEASED.canExpire()).toBe(false);
        expect(HoldStatus.CANCELLED.canExpire()).toBe(false);
        expect(HoldStatus.EXPIRED.canExpire()).toBe(false);
      });
    });

    describe('canExpireAutomatically', () => {
      it('should return true for ACTIVE status with past expiry time', () => {
        const pastExpiry = new Date(Date.now() - 1000); // 1 second ago
        expect(HoldStatus.ACTIVE.canExpireAutomatically(pastExpiry)).toBe(true);
      });

      it('should return false for ACTIVE status with future expiry time', () => {
        const futureExpiry = new Date(Date.now() + 1000); // 1 second from now
        expect(HoldStatus.ACTIVE.canExpireAutomatically(futureExpiry)).toBe(false);
      });

      it('should return false for ACTIVE status without expiry time', () => {
        expect(HoldStatus.ACTIVE.canExpireAutomatically(null)).toBe(false);
      });

      it('should return false for non-ACTIVE status', () => {
        const pastExpiry = new Date(Date.now() - 1000);
        expect(HoldStatus.RELEASED.canExpireAutomatically(pastExpiry)).toBe(false);
      });
    });

    describe('state query methods', () => {
      it('should correctly identify each state', () => {
        expect(HoldStatus.ACTIVE.isActive()).toBe(true);
        expect(HoldStatus.ACTIVE.isReleased()).toBe(false);
        expect(HoldStatus.ACTIVE.isCancelled()).toBe(false);
        expect(HoldStatus.ACTIVE.isExpired()).toBe(false);

        expect(HoldStatus.RELEASED.isReleased()).toBe(true);
        expect(HoldStatus.RELEASED.isActive()).toBe(false);

        expect(HoldStatus.CANCELLED.isCancelled()).toBe(true);
        expect(HoldStatus.CANCELLED.isActive()).toBe(false);

        expect(HoldStatus.EXPIRED.isExpired()).toBe(true);
        expect(HoldStatus.EXPIRED.isActive()).toBe(false);
      });
    });

    describe('canTransitionTo', () => {
      it('should return true for valid transitions from ACTIVE', () => {
        expect(HoldStatus.ACTIVE.canTransitionTo('released')).toBe(true);
        expect(HoldStatus.ACTIVE.canTransitionTo('cancelled')).toBe(true);
        expect(HoldStatus.ACTIVE.canTransitionTo('expired')).toBe(true);
      });

      it('should return false for transitions from final states', () => {
        expect(HoldStatus.RELEASED.canTransitionTo('cancelled')).toBe(false);
        expect(HoldStatus.RELEASED.canTransitionTo('expired')).toBe(false);
        expect(HoldStatus.CANCELLED.canTransitionTo('released')).toBe(false);
        expect(HoldStatus.CANCELLED.canTransitionTo('expired')).toBe(false);
        expect(HoldStatus.EXPIRED.canTransitionTo('released')).toBe(false);
        expect(HoldStatus.EXPIRED.canTransitionTo('cancelled')).toBe(false);
      });
    });

    describe('equality', () => {
      it('should return true for same status instances', () => {
        const status1 = HoldStatus.fromString('active');
        const status2 = HoldStatus.fromString('active');

        expect(status1.equals(status2)).toBe(true);
      });

      it('should return false for different statuses', () => {
        const active = HoldStatus.ACTIVE;
        const released = HoldStatus.RELEASED;

        expect(active.equals(released)).toBe(false);
      });

      it('should work with reconstruct', () => {
        const original = HoldStatus.ACTIVE;
        const reconstructed = HoldStatus.reconstruct('active');

        expect(original.equals(reconstructed)).toBe(true);
      });
    });

    describe('getValue and toString', () => {
      it('should return correct value for each status', () => {
        expect(HoldStatus.ACTIVE.getValue()).toBe('active');
        expect(HoldStatus.RELEASED.getValue()).toBe('released');
        expect(HoldStatus.CANCELLED.getValue()).toBe('cancelled');
        expect(HoldStatus.EXPIRED.getValue()).toBe('expired');
      });

      it('toString should return the status value', () => {
        expect(HoldStatus.ACTIVE.toString()).toBe('active');
      });
    });
  });
});
