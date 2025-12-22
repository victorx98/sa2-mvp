import { describe, it, expect } from '@jest/globals';
import {
  JobStatusVO,
  InvalidJobStatusException,
  InvalidJobStatusTransitionException,
} from '../job-status.vo';

describe('JobStatusVO Value Object', () => {
  describe('fromString', () => {
    it('should create ACTIVE status', () => {
      const status = JobStatusVO.fromString('active');
      expect(status.isActive()).toBe(true);
      expect(status.getValue()).toBe('active');
    });

    it('should create INACTIVE status', () => {
      const status = JobStatusVO.fromString('inactive');
      expect(status.isInactive()).toBe(true);
      expect(status.getValue()).toBe('inactive');
    });

    it('should create EXPIRED status', () => {
      const status = JobStatusVO.fromString('expired');
      expect(status.isExpired()).toBe(true);
      expect(status.getValue()).toBe('expired');
    });

    it('should handle case-insensitive input', () => {
      expect(JobStatusVO.fromString('ACTIVE').isActive()).toBe(true);
      expect(JobStatusVO.fromString('Active').isActive()).toBe(true);
      expect(JobStatusVO.fromString('INACTIVE').isInactive()).toBe(true);
      expect(JobStatusVO.fromString('EXPIRED').isExpired()).toBe(true);
    });

    it('should throw InvalidJobStatusException for invalid status', () => {
      expect(() => JobStatusVO.fromString('invalid')).toThrow(InvalidJobStatusException);
    });
  });

  describe('state transitions', () => {
    describe('ACTIVE → INACTIVE/EXPIRED', () => {
      it('should allow transition from ACTIVE to INACTIVE', () => {
        const active = JobStatusVO.ACTIVE;
        const inactive = active.transitionToInactive();

        expect(inactive.isInactive()).toBe(true);
      });

      it('should allow transition from ACTIVE to EXPIRED', () => {
        const active = JobStatusVO.ACTIVE;
        const expired = active.transitionToExpired();

        expect(expired.isExpired()).toBe(true);
      });

      it('should not allow transition from INACTIVE to EXPIRED', () => {
        const inactive = JobStatusVO.INACTIVE;
        expect(() => inactive.transitionToExpired()).toThrow(InvalidJobStatusTransitionException);
      });
    });

    describe('INACTIVE/EXPIRED → ACTIVE', () => {
      it('should allow transition from INACTIVE to ACTIVE', () => {
        const inactive = JobStatusVO.INACTIVE;
        const active = inactive.transitionToActive();

        expect(active.isActive()).toBe(true);
      });

      it('should allow transition from EXPIRED to ACTIVE', () => {
        const expired = JobStatusVO.EXPIRED;
        const active = expired.transitionToActive();

        expect(active.isActive()).toBe(true);
      });
    });
  });

  describe('business rules', () => {
    describe('isVisibleToStudents', () => {
      it('should return true for ACTIVE status', () => {
        expect(JobStatusVO.ACTIVE.isVisibleToStudents()).toBe(true);
      });

      it('should return false for non-ACTIVE statuses', () => {
        expect(JobStatusVO.INACTIVE.isVisibleToStudents()).toBe(false);
        expect(JobStatusVO.EXPIRED.isVisibleToStudents()).toBe(false);
      });
    });

    describe('state query methods', () => {
      it('should correctly identify each state', () => {
        expect(JobStatusVO.ACTIVE.isActive()).toBe(true);
        expect(JobStatusVO.ACTIVE.isInactive()).toBe(false);
        expect(JobStatusVO.ACTIVE.isExpired()).toBe(false);

        expect(JobStatusVO.INACTIVE.isInactive()).toBe(true);
        expect(JobStatusVO.INACTIVE.isActive()).toBe(false);

        expect(JobStatusVO.EXPIRED.isExpired()).toBe(true);
        expect(JobStatusVO.EXPIRED.isActive()).toBe(false);
      });
    });

    describe('canTransitionTo', () => {
      it('should return true for valid transitions', () => {
        expect(JobStatusVO.ACTIVE.canTransitionTo('inactive')).toBe(true);
        expect(JobStatusVO.ACTIVE.canTransitionTo('expired')).toBe(true);
        expect(JobStatusVO.INACTIVE.canTransitionTo('active')).toBe(true);
        expect(JobStatusVO.EXPIRED.canTransitionTo('active')).toBe(true);
      });

      it('should return false for invalid transitions', () => {
        expect(JobStatusVO.ACTIVE.canTransitionTo('active')).toBe(false);
        expect(JobStatusVO.INACTIVE.canTransitionTo('inactive')).toBe(false);
        expect(JobStatusVO.EXPIRED.canTransitionTo('expired')).toBe(false);
        expect(JobStatusVO.INACTIVE.canTransitionTo('expired')).toBe(false);
      });
    });

    describe('equality', () => {
      it('should return true for same status instances', () => {
        const status1 = JobStatusVO.fromString('active');
        const status2 = JobStatusVO.fromString('active');

        expect(status1.equals(status2)).toBe(true);
      });

      it('should return false for different statuses', () => {
        const active = JobStatusVO.ACTIVE;
        const inactive = JobStatusVO.INACTIVE;

        expect(active.equals(inactive)).toBe(false);
      });

      it('should work with reconstruct', () => {
        const original = JobStatusVO.ACTIVE;
        const reconstructed = JobStatusVO.reconstruct('active');

        expect(original.equals(reconstructed)).toBe(true);
      });
    });

    describe('getValue and toString', () => {
      it('should return correct value for each status', () => {
        expect(JobStatusVO.ACTIVE.getValue()).toBe('active');
        expect(JobStatusVO.INACTIVE.getValue()).toBe('inactive');
        expect(JobStatusVO.EXPIRED.getValue()).toBe('expired');
      });

      it('toString should return the status value', () => {
        expect(JobStatusVO.ACTIVE.toString()).toBe('active');
      });
    });
  });
});
