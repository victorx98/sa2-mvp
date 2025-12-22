import { describe, it, expect } from '@jest/globals';
import {
  ApplicationTypeVO,
  InvalidApplicationTypeException,
} from '../application-type.vo';

describe('ApplicationTypeVO Value Object', () => {
  describe('fromString', () => {
    it('should create DIRECT type', () => {
      const type = ApplicationTypeVO.fromString('direct');
      expect(type.isDirect()).toBe(true);
      expect(type.getValue()).toBe('direct');
    });

    it('should create PROXY type', () => {
      const type = ApplicationTypeVO.fromString('proxy');
      expect(type.isProxy()).toBe(true);
      expect(type.getValue()).toBe('proxy');
    });

    it('should create REFERRAL type', () => {
      const type = ApplicationTypeVO.fromString('referral');
      expect(type.isReferral()).toBe(true);
      expect(type.getValue()).toBe('referral');
    });

    it('should create BD type', () => {
      const type = ApplicationTypeVO.fromString('bd');
      expect(type.isBD()).toBe(true);
      expect(type.getValue()).toBe('bd');
    });

    it('should handle case-insensitive input', () => {
      expect(ApplicationTypeVO.fromString('DIRECT').isDirect()).toBe(true);
      expect(ApplicationTypeVO.fromString('Proxy').isProxy()).toBe(true);
      expect(ApplicationTypeVO.fromString('REFERRAL').isReferral()).toBe(true);
      expect(ApplicationTypeVO.fromString('Bd').isBD()).toBe(true);
    });

    it('should throw InvalidApplicationTypeException for invalid type', () => {
      expect(() => ApplicationTypeVO.fromString('invalid')).toThrow(
        InvalidApplicationTypeException,
      );
    });
  });

  describe('type query methods', () => {
    it('should correctly identify each type', () => {
      expect(ApplicationTypeVO.DIRECT.isDirect()).toBe(true);
      expect(ApplicationTypeVO.DIRECT.isProxy()).toBe(false);
      expect(ApplicationTypeVO.DIRECT.isReferral()).toBe(false);
      expect(ApplicationTypeVO.DIRECT.isBD()).toBe(false);

      expect(ApplicationTypeVO.PROXY.isProxy()).toBe(true);
      expect(ApplicationTypeVO.PROXY.isDirect()).toBe(false);

      expect(ApplicationTypeVO.REFERRAL.isReferral()).toBe(true);
      expect(ApplicationTypeVO.REFERRAL.requiresMentor()).toBe(true);

      expect(ApplicationTypeVO.BD.isBD()).toBe(true);
      expect(ApplicationTypeVO.BD.requiresServiceEntitlement()).toBe(true);
    });
  });

  describe('business rules', () => {
    it('should correctly identify if type requires mentor', () => {
      expect(ApplicationTypeVO.REFERRAL.requiresMentor()).toBe(true);
      expect(ApplicationTypeVO.DIRECT.requiresMentor()).toBe(false);
      expect(ApplicationTypeVO.PROXY.requiresMentor()).toBe(false);
      expect(ApplicationTypeVO.BD.requiresMentor()).toBe(false);
    });

    it('should correctly identify if type requires service entitlement', () => {
      expect(ApplicationTypeVO.PROXY.requiresServiceEntitlement()).toBe(true);
      expect(ApplicationTypeVO.BD.requiresServiceEntitlement()).toBe(true);
      expect(ApplicationTypeVO.DIRECT.requiresServiceEntitlement()).toBe(false);
      expect(ApplicationTypeVO.REFERRAL.requiresServiceEntitlement()).toBe(false);
    });
  });

  describe('reconstruct', () => {
    it('should reconstruct from valid type string', () => {
      const type = ApplicationTypeVO.reconstruct('direct');
      expect(type.isDirect()).toBe(true);
      expect(type.getValue()).toBe('direct');
    });
  });

  describe('equality', () => {
    it('should return true for same type instances', () => {
      const type1 = ApplicationTypeVO.fromString('referral');
      const type2 = ApplicationTypeVO.fromString('referral');
      expect(type1.equals(type2)).toBe(true);
    });

    it('should return false for different types', () => {
      const direct = ApplicationTypeVO.DIRECT;
      const proxy = ApplicationTypeVO.PROXY;
      expect(direct.equals(proxy)).toBe(false);
    });
  });

  describe('getValue and toString', () => {
    it('should return correct value for each type', () => {
      expect(ApplicationTypeVO.REFERRAL.getValue()).toBe('referral');
      expect(ApplicationTypeVO.PROXY.getValue()).toBe('proxy');
    });

    it('toString should return the type value', () => {
      expect(ApplicationTypeVO.BD.toString()).toBe('bd');
    });
  });
});
