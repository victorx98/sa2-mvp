import { describe, it, expect } from '@jest/globals';
import { ContractStatus, InvalidContractStatusException, InvalidContractStatusTransitionException } from '../contract-status.vo';

describe('ContractStatus Value Object', () => {
  describe('fromString', () => {
    it('should create DRAFT status', () => {
      const status = ContractStatus.fromString('DRAFT');
      expect(status.isDraft()).toBe(true);
      expect(status.getValue()).toBe('DRAFT');
    });

    it('should create SIGNED status', () => {
      const status = ContractStatus.fromString('SIGNED');
      expect(status.isSigned()).toBe(true);
    });

    it('should create ACTIVE status', () => {
      const status = ContractStatus.fromString('ACTIVE');
      expect(status.isActive()).toBe(true);
    });

    it('should create SUSPENDED status', () => {
      const status = ContractStatus.fromString('SUSPENDED');
      expect(status.isSuspended()).toBe(true);
    });

    it('should create COMPLETED status', () => {
      const status = ContractStatus.fromString('COMPLETED');
      expect(status.isCompleted()).toBe(true);
    });

    it('should create TERMINATED status', () => {
      const status = ContractStatus.fromString('TERMINATED');
      expect(status.isTerminated()).toBe(true);
    });

    it('should throw InvalidContractStatusException for invalid status', () => {
      expect(() => ContractStatus.fromString('INVALID')).toThrow(InvalidContractStatusException);
    });
  });

  describe('state transitions', () => {
    describe('DRAFT → SIGNED', () => {
      it('should allow transition from DRAFT to SIGNED', () => {
        const draft = ContractStatus.DRAFT;
        const signed = draft.transitionToSigned();

        expect(signed.isSigned()).toBe(true);
      });

      it('should not allow transition from SIGNED to SIGNED', () => {
        const signed = ContractStatus.SIGNED;
        expect(() => signed.transitionToSigned()).toThrow(InvalidContractStatusTransitionException);
      });
    });

    describe('SIGNED → ACTIVE', () => {
      it('should allow transition from SIGNED to ACTIVE', () => {
        const signed = ContractStatus.SIGNED;
        const active = signed.transitionToActive();

        expect(active.isActive()).toBe(true);
      });

      it('should not allow transition from DRAFT to ACTIVE', () => {
        const draft = ContractStatus.DRAFT;
        expect(() => draft.transitionToActive()).toThrow(InvalidContractStatusTransitionException);
      });
    });

    describe('ACTIVE → SUSPENDED/COMPLETED/TERMINATED', () => {
      it('should allow transition from ACTIVE to SUSPENDED', () => {
        const active = ContractStatus.ACTIVE;
        const suspended = active.transitionToSuspended();

        expect(suspended.isSuspended()).toBe(true);
      });

      it('should allow transition from ACTIVE to COMPLETED', () => {
        const active = ContractStatus.ACTIVE;
        const completed = active.transitionToCompleted();

        expect(completed.isCompleted()).toBe(true);
      });

      it('should allow transition from ACTIVE to TERMINATED', () => {
        const active = ContractStatus.ACTIVE;
        const terminated = active.transitionToTerminated();

        expect(terminated.isTerminated()).toBe(true);
      });

      it('should not allow transition from ACTIVE to DRAFT', () => {
        const active = ContractStatus.ACTIVE;
        expect(() => active.transitionToSigned()).toThrow(InvalidContractStatusTransitionException);
      });
    });

    describe('SUSPENDED → ACTIVE', () => {
      it('should allow transition from SUSPENDED to ACTIVE', () => {
        const suspended = ContractStatus.SUSPENDED;
        const active = suspended.transitionToActive();

        expect(active.isActive()).toBe(true);
      });

      it('should not allow transition from SUSPENDED to SIGNED', () => {
        const suspended = ContractStatus.SUSPENDED;
        expect(() => suspended.transitionToSigned()).toThrow(InvalidContractStatusTransitionException);
      });
    });

    describe('final states', () => {
      it('should not allow transition from COMPLETED to any state', () => {
        const completed = ContractStatus.COMPLETED;
        expect(() => completed.transitionToActive()).toThrow(InvalidContractStatusTransitionException);
        expect(() => completed.transitionToSuspended()).toThrow(InvalidContractStatusTransitionException);
      });

      it('should not allow transition from TERMINATED to any state', () => {
        const terminated = ContractStatus.TERMINATED;
        expect(() => terminated.transitionToActive()).toThrow(InvalidContractStatusTransitionException);
        expect(() => terminated.transitionToSuspended()).toThrow(InvalidContractStatusTransitionException);
      });
    });
  });

  describe('business rules', () => {
    describe('canConsumeServices', () => {
      it('should return true for ACTIVE status', () => {
        expect(ContractStatus.ACTIVE.canConsumeServices()).toBe(true);
      });

      it('should return false for non-ACTIVE statuses', () => {
        expect(ContractStatus.DRAFT.canConsumeServices()).toBe(false);
        expect(ContractStatus.SIGNED.canConsumeServices()).toBe(false);
        expect(ContractStatus.SUSPENDED.canConsumeServices()).toBe(false);
        expect(ContractStatus.COMPLETED.canConsumeServices()).toBe(false);
        expect(ContractStatus.TERMINATED.canConsumeServices()).toBe(false);
      });
    });

    describe('canBeModified', () => {
      it('should return true for DRAFT status', () => {
        expect(ContractStatus.DRAFT.canBeModified()).toBe(true);
      });

      it('should return false for non-DRAFT statuses', () => {
        expect(ContractStatus.SIGNED.canBeModified()).toBe(false);
        expect(ContractStatus.ACTIVE.canBeModified()).toBe(false);
        expect(ContractStatus.SUSPENDED.canBeModified()).toBe(false);
      });
    });

    describe('state query methods', () => {
      it('should correctly identify each state', () => {
        expect(ContractStatus.DRAFT.isDraft()).toBe(true);
        expect(ContractStatus.DRAFT.isSigned()).toBe(false);
        expect(ContractStatus.DRAFT.isActive()).toBe(false);

        expect(ContractStatus.SIGNED.isSigned()).toBe(true);
        expect(ContractStatus.SIGNED.isDraft()).toBe(false);

        expect(ContractStatus.ACTIVE.isActive()).toBe(true);
        expect(ContractStatus.ACTIVE.isSuspended()).toBe(false);

        expect(ContractStatus.SUSPENDED.isSuspended()).toBe(true);
        expect(ContractStatus.SUSPENDED.isActive()).toBe(false);

        expect(ContractStatus.COMPLETED.isCompleted()).toBe(true);
        expect(ContractStatus.COMPLETED.isTerminated()).toBe(false);

        expect(ContractStatus.TERMINATED.isTerminated()).toBe(true);
        expect(ContractStatus.TERMINATED.isCompleted()).toBe(false);
      });
    });

    describe('canTransitionTo', () => {
      it('should return true for valid transitions', () => {
        expect(ContractStatus.DRAFT.canTransitionTo('SIGNED')).toBe(true);
        expect(ContractStatus.SIGNED.canTransitionTo('ACTIVE')).toBe(true);
        expect(ContractStatus.ACTIVE.canTransitionTo('SUSPENDED')).toBe(true);
        expect(ContractStatus.ACTIVE.canTransitionTo('COMPLETED')).toBe(true);
        expect(ContractStatus.ACTIVE.canTransitionTo('TERMINATED')).toBe(true);
        expect(ContractStatus.SUSPENDED.canTransitionTo('ACTIVE')).toBe(true);
      });

      it('should return false for invalid transitions', () => {
        expect(ContractStatus.DRAFT.canTransitionTo('ACTIVE')).toBe(false);
        expect(ContractStatus.SIGNED.canTransitionTo('SUSPENDED')).toBe(false);
        expect(ContractStatus.COMPLETED.canTransitionTo('ACTIVE')).toBe(false);
        expect(ContractStatus.TERMINATED.canTransitionTo('DRAFT')).toBe(false);
      });
    });

    describe('equality', () => {
      it('should return true for same status instances', () => {
        const status1 = ContractStatus.fromString('ACTIVE');
        const status2 = ContractStatus.fromString('ACTIVE');

        expect(status1.equals(status2)).toBe(true);
      });

      it('should return false for different statuses', () => {
        const draft = ContractStatus.DRAFT;
        const active = ContractStatus.ACTIVE;

        expect(draft.equals(active)).toBe(false);
      });

      it('should work with reconstruct', () => {
        const original = ContractStatus.ACTIVE;
        const reconstructed = ContractStatus.reconstruct('ACTIVE');

        expect(original.equals(reconstructed)).toBe(true);
      });
    });
  });
});
