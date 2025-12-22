import { describe, it, expect } from '@jest/globals';
import {
  ApplicationStatus,
  InvalidApplicationStatusException,
} from '../application-status.vo';

describe('ApplicationStatus Value Object', () => {
  describe('fromString', () => {
    it('should create RECOMMENDED status', () => {
      const status = ApplicationStatus.fromString('recommended');
      expect(status.isRecommended()).toBe(true);
      expect(status.getValue()).toBe('recommended');
    });

    it('should create INTERESTED status', () => {
      const status = ApplicationStatus.fromString('interested');
      expect(status.isInterested()).toBe(true);
      expect(status.getValue()).toBe('interested');
    });

    it('should create SUBMITTED status', () => {
      const status = ApplicationStatus.fromString('submitted');
      expect(status.isSubmitted()).toBe(true);
      expect(status.getValue()).toBe('submitted');
    });

    it('should create GOT_OFFER status', () => {
      const status = ApplicationStatus.fromString('got_offer');
      expect(status.isGotOffer()).toBe(true);
      expect(status.getValue()).toBe('got_offer');
    });

    it('should handle case-insensitive input', () => {
      expect(ApplicationStatus.fromString('RECOMMENDED').isRecommended()).toBe(true);
      expect(ApplicationStatus.fromString('Interested').isInterested()).toBe(true);
      expect(ApplicationStatus.fromString('SUBMITTED').isSubmitted()).toBe(true);
    });

    it('should throw InvalidApplicationStatusException for invalid status', () => {
      expect(() => ApplicationStatus.fromString('invalid')).toThrow(
        InvalidApplicationStatusException,
      );
    });
  });

  describe('state query methods', () => {
    it('should correctly identify each state', () => {
      expect(ApplicationStatus.RECOMMENDED.isRecommended()).toBe(true);
      expect(ApplicationStatus.RECOMMENDED.isInterested()).toBe(false);

      expect(ApplicationStatus.INTERESTED.isInterested()).toBe(true);
      expect(ApplicationStatus.INTERESTED.isNotInterested()).toBe(false);

      expect(ApplicationStatus.SUBMITTED.isSubmitted()).toBe(true);
      expect(ApplicationStatus.SUBMITTED.isInterviewed()).toBe(false);

      expect(ApplicationStatus.GOT_OFFER.isGotOffer()).toBe(true);
      expect(ApplicationStatus.GOT_OFFER.isRejected()).toBe(false);
    });
  });

  describe('canTransitionTo', () => {
    it('should return true for valid transitions from SUBMITTED', () => {
      expect(ApplicationStatus.SUBMITTED.canTransitionTo('interviewed')).toBe(true);
      expect(ApplicationStatus.SUBMITTED.canTransitionTo('rejected')).toBe(true);
    });

    it('should return true for valid transitions from RECOMMENDED', () => {
      expect(ApplicationStatus.RECOMMENDED.canTransitionTo('interested')).toBe(true);
      expect(ApplicationStatus.RECOMMENDED.canTransitionTo('not_interested')).toBe(true);
      expect(ApplicationStatus.RECOMMENDED.canTransitionTo('revoked')).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(ApplicationStatus.SUBMITTED.canTransitionTo('got_offer')).toBe(false);
      expect(ApplicationStatus.REJECTED.canTransitionTo('submitted')).toBe(false);
    });
  });

  describe('reconstruct', () => {
    it('should reconstruct from valid status string', () => {
      const status = ApplicationStatus.reconstruct('recommended');
      expect(status.isRecommended()).toBe(true);
      expect(status.getValue()).toBe('recommended');
    });
  });

  describe('equality', () => {
    it('should return true for same status instances', () => {
      const status1 = ApplicationStatus.fromString('submitted');
      const status2 = ApplicationStatus.fromString('submitted');
      expect(status1.equals(status2)).toBe(true);
    });

    it('should return false for different statuses', () => {
      const submitted = ApplicationStatus.SUBMITTED;
      const interviewed = ApplicationStatus.INTERVIEWED;
      expect(submitted.equals(interviewed)).toBe(false);
    });
  });

  describe('getValue and toString', () => {
    it('should return correct value for each status', () => {
      expect(ApplicationStatus.INTERVIEWED.getValue()).toBe('interviewed');
      expect(ApplicationStatus.REJECTED.getValue()).toBe('rejected');
    });

    it('toString should return the status value', () => {
      expect(ApplicationStatus.SUBMITTED.toString()).toBe('submitted');
    });
  });
});
