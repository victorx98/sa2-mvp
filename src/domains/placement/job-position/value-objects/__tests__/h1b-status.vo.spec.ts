import { describe, it, expect } from '@jest/globals';
import {
  H1BStatusVO,
  InvalidH1BStatusException,
} from '../h1b-status.vo';

describe('H1BStatusVO Value Object', () => {
  describe('fromString', () => {
    it('should create YES status', () => {
      const status = H1BStatusVO.fromString('yes');
      expect(status.isSupported()).toBe(true);
      expect(status.getValue()).toBe('yes');
    });

    it('should create MAYBE status', () => {
      const status = H1BStatusVO.fromString('maybe');
      expect(status.isUncertain()).toBe(true);
      expect(status.getValue()).toBe('maybe');
    });

    it('should create NO status', () => {
      const status = H1BStatusVO.fromString('no');
      expect(status.isNotSupported()).toBe(true);
      expect(status.getValue()).toBe('no');
    });

    it('should handle case-insensitive input', () => {
      expect(H1BStatusVO.fromString('YES').isSupported()).toBe(true);
      expect(H1BStatusVO.fromString('Yes').isSupported()).toBe(true);
      expect(H1BStatusVO.fromString('MAYBE').isUncertain()).toBe(true);
      expect(H1BStatusVO.fromString('NO').isNotSupported()).toBe(true);
    });

    it('should throw InvalidH1BStatusException for invalid status', () => {
      expect(() =>
        H1BStatusVO.fromString('invalid')).toThrow(InvalidH1BStatusException);
    });
  });

  describe('status query methods', () => {
    it('should correctly identify each status', () => {
      expect(H1BStatusVO.YES.isSupported()).toBe(true);
      expect(H1BStatusVO.YES.isUncertain()).toBe(false);
      expect(H1BStatusVO.YES.isNotSupported()).toBe(false);

      expect(H1BStatusVO.MAYBE.isUncertain()).toBe(true);
      expect(H1BStatusVO.MAYBE.isSupported()).toBe(false);
      expect(H1BStatusVO.MAYBE.isNotSupported()).toBe(false);

      expect(H1BStatusVO.NO.isNotSupported()).toBe(true);
      expect(H1BStatusVO.NO.isSupported()).toBe(false);
      expect(H1BStatusVO.NO.isUncertain()).toBe(false);
    });
  });

  describe('reconstruct', () => {
    it('should reconstruct from valid status string', () => {
      const status = H1BStatusVO.reconstruct('yes');
      expect(status.isSupported()).toBe(true);
      expect(status.getValue()).toBe('yes');
    });
  });

  describe('equality', () => {
    it('should return true for same status instances', () => {
      const status1 = H1BStatusVO.fromString('yes');
      const status2 = H1BStatusVO.fromString('yes');
      expect(status1.equals(status2)).toBe(true);
    });

    it('should return false for different statuses', () => {
      const yes = H1BStatusVO.YES;
      const no = H1BStatusVO.NO;
      expect(yes.equals(no)).toBe(false);
    });
  });

  describe('getValue', () => {
    it('should return correct value for each status', () => {
      expect(H1BStatusVO.YES.getValue()).toBe('yes');
      expect(H1BStatusVO.MAYBE.getValue()).toBe('maybe');
      expect(H1BStatusVO.NO.getValue()).toBe('no');
    });
  });
});
