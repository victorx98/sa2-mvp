import { DomainException } from '@core/exceptions/domain.exception';

/**
 * ContractStatus Value Object (合同状态值对象)
 * State machine for contract lifecycle management (合同生命周期管理状态机)
 */
export class ContractStatus {
  private static readonly STATUSES = {
    DRAFT: 'DRAFT',           // Initial state, not signed (初始状态，未签署)
    SIGNED: 'SIGNED',         // Signed but not yet active (已签署但尚未激活)
    ACTIVE: 'ACTIVE',         // Active and valid (激活且有效)
    SUSPENDED: 'SUSPENDED',   // Temporarily suspended (暂时挂起)
    COMPLETED: 'COMPLETED',   // All services consumed (所有服务已消费完)
    TERMINATED: 'TERMINATED', // Terminated early (提前终止)
  };

  static DRAFT = new ContractStatus(this.STATUSES.DRAFT);
  static SIGNED = new ContractStatus(this.STATUSES.SIGNED);
  static ACTIVE = new ContractStatus(this.STATUSES.ACTIVE);
  static SUSPENDED = new ContractStatus(this.STATUSES.SUSPENDED);
  static COMPLETED = new ContractStatus(this.STATUSES.COMPLETED);
  static TERMINATED = new ContractStatus(this.STATUSES.TERMINATED);

  private readonly transitions: Map<string, string[]> = new Map([
    // From DRAFT: can sign (从DRAFT：可以签署)
    [ContractStatus.STATUSES.DRAFT, [ContractStatus.STATUSES.SIGNED]],

    // From SIGNED: can activate (从SIGNED：可以激活)
    [ContractStatus.STATUSES.SIGNED, [ContractStatus.STATUSES.ACTIVE]],

    // From ACTIVE: can suspend, complete, or terminate (从ACTIVE：可以挂起、完成或终止)
    [
      ContractStatus.STATUSES.ACTIVE,
      [ContractStatus.STATUSES.SUSPENDED, ContractStatus.STATUSES.COMPLETED, ContractStatus.STATUSES.TERMINATED],
    ],

    // From SUSPENDED: can re-activate (从SUSPENDED：可以重新激活)
    [ContractStatus.STATUSES.SUSPENDED, [ContractStatus.STATUSES.ACTIVE]],

    // From COMPLETED: no transitions (final state) (从COMPLETED：无转换（最终状态）)
    [ContractStatus.STATUSES.COMPLETED, []],

    // From TERMINATED: no transitions (final state) (从TERMINATED：无转换（最终状态）)
    [ContractStatus.STATUSES.TERMINATED, []],
  ]);

  private constructor(private readonly value: string) {}

  /**
   * Factory method to create a ContractStatus (创建ContractStatus的工厂方法)
   *
   * @param value - Status value string (状态值字符串)
   * @returns ContractStatus instance (ContractStatus实例)
   * @throws InvalidContractStatusException if value is invalid (值无效时抛出InvalidContractStatusException)
   */
  static fromString(value: string): ContractStatus {
    switch (value.toUpperCase()) {
      case this.STATUSES.DRAFT:
        return this.DRAFT;
      case this.STATUSES.SIGNED:
        return this.SIGNED;
      case this.STATUSES.ACTIVE:
        return this.ACTIVE;
      case this.STATUSES.SUSPENDED:
        return this.SUSPENDED;
      case this.STATUSES.COMPLETED:
        return this.COMPLETED;
      case this.STATUSES.TERMINATED:
        return this.TERMINATED;
      default:
        throw new InvalidContractStatusException(value);
    }
  }

  /**
   * Private factory method for reconstruction (私有工厂方法，用于重建)
   *
   * @param value - Status value string (状态值字符串)
   * @returns ContractStatus instance (ContractStatus实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(value: string): ContractStatus {
    return new ContractStatus(value);
  }

  /**
   * Transition to SIGNED status (转换到SIGNED状态)
   * Valid transition: DRAFT → SIGNED (有效转换：DRAFT → SIGNED)
   *
   * @returns SIGNED status (SIGNED状态)
   * @throws InvalidStatusTransitionException if transition is invalid (转换无效时抛出InvalidStatusTransitionException)
   */
  transitionToSigned(): ContractStatus {
    if (!this.canTransitionTo(ContractStatus.SIGNED.value)) {
      throw new InvalidContractStatusTransitionException(
        this.value,
        ContractStatus.SIGNED.value,
      );
    }
    return ContractStatus.SIGNED;
  }

  /**
   * Transition to ACTIVE status (转换到ACTIVE状态)
   * Valid transition: SIGNED → ACTIVE (有效转换：SIGNED → ACTIVE)
   *
   * @returns ACTIVE status (ACTIVE状态)
   * @throws InvalidStatusTransitionException if transition is invalid (转换无效时抛出InvalidStatusTransitionException)
   */
  transitionToActive(): ContractStatus {
    if (!this.canTransitionTo(ContractStatus.ACTIVE.value)) {
      throw new InvalidContractStatusTransitionException(
        this.value,
        ContractStatus.ACTIVE.value,
      );
    }
    return ContractStatus.ACTIVE;
  }

  /**
   * Transition to SUSPENDED status (转换到SUSPENDED状态)
   * Valid transition: ACTIVE → SUSPENDED (有效转换：ACTIVE → SUSPENDED)
   *
   * @returns SUSPENDED status (SUSPENDED状态)
   * @throws InvalidStatusTransitionException if transition is invalid (转换无效时抛出InvalidStatusTransitionException)
   */
  transitionToSuspended(): ContractStatus {
    if (!this.canTransitionTo(ContractStatus.SUSPENDED.value)) {
      throw new InvalidContractStatusTransitionException(
        this.value,
        ContractStatus.SUSPENDED.value,
      );
    }
    return ContractStatus.SUSPENDED;
  }

  /**
   * Transition to COMPLETED status (转换到COMPLETED状态)
   * Valid transition: ACTIVE → COMPLETED (有效转换：ACTIVE → COMPLETED)
   *
   * @returns COMPLETED status (COMPLETED状态)
   * @throws InvalidStatusTransitionException if transition is invalid (转换无效时抛出InvalidStatusTransitionException)
   */
  transitionToCompleted(): ContractStatus {
    if (!this.canTransitionTo(ContractStatus.COMPLETED.value)) {
      throw new InvalidContractStatusTransitionException(
        this.value,
        ContractStatus.COMPLETED.value,
      );
    }
    return ContractStatus.COMPLETED;
  }

  /**
   * Transition to TERMINATED status (转换到TERMINATED状态)
   * Valid transition: ACTIVE → TERMINATED (有效转换：ACTIVE → TERMINATED)
   *
   * @returns TERMINATED status (TERMINATED状态)
   * @throws InvalidStatusTransitionException if transition is invalid (转换无效时抛出InvalidStatusTransitionException)
   */
  transitionToTerminated(): ContractStatus {
    if (!this.canTransitionTo(ContractStatus.TERMINATED.value)) {
      throw new InvalidContractStatusTransitionException(
        this.value,
        ContractStatus.TERMINATED.value,
      );
    }
    return ContractStatus.TERMINATED;
  }

  /**
   * Check if can transition to target status (检查是否可以转换到目标状态)
   *
   * @param targetStatus - Target status value (目标状态值)
   * @returns true if transition is valid (转换有效时返回true)
   */
  canTransitionTo(targetStatus: string): boolean {
    const validTargets = this.transitions.get(this.value) || [];
    return validTargets.includes(targetStatus);
  }

  /**
   * Check if current status is DRAFT (检查当前状态是否为DRAFT)
   *
   * @returns true if status is DRAFT (状态为DRAFT时返回true)
   */
  isDraft(): boolean {
    return this.value === ContractStatus.STATUSES.DRAFT;
  }

  /**
   * Check if current status is SIGNED (检查当前状态是否为SIGNED)
   *
   * @returns true if status is SIGNED (状态为SIGNED时返回true)
   */
  isSigned(): boolean {
    return this.value === ContractStatus.STATUSES.SIGNED;
  }

  /**
   * Check if current status is ACTIVE (检查当前状态是否为ACTIVE)
   *
   * @returns true if status is ACTIVE (状态为ACTIVE时返回true)
   */
  isActive(): boolean {
    return this.value === ContractStatus.STATUSES.ACTIVE;
  }

  /**
   * Check if current status is SUSPENDED (检查当前状态是否为SUSPENDED)
   *
   * @returns true if status is SUSPENDED (状态为SUSPENDED时返回true)
   */
  isSuspended(): boolean {
    return this.value === ContractStatus.STATUSES.SUSPENDED;
  }

  /**
   * Check if current status is COMPLETED (检查当前状态是否为COMPLETED)
   *
   * @returns true if status is COMPLETED (状态为COMPLETED时返回true)
   */
  isCompleted(): boolean {
    return this.value === ContractStatus.STATUSES.COMPLETED;
  }

  /**
   * Check if current status is TERMINATED (检查当前状态是否为TERMINATED)
   *
   * @returns true if status is TERMINATED (状态为TERMINATED时返回true)
   */
  isTerminated(): boolean {
    return this.value === ContractStatus.STATUSES.TERMINATED;
  }

  /**
   * Check if contract can consume services (检查合同是否可以消费服务)
   * Only ACTIVE contracts can consume services (只有ACTIVE合同可以消费服务)
   *
   * @returns true if can consume services (可以消费服务时返回true)
   */
  canConsumeServices(): boolean {
    return this.isActive();
  }

  /**
   * Check if contract can be modified (检查合同是否可以修改)
   * Only DRAFT contracts can be modified (只有DRAFT合同可以修改)
   *
   * @returns true if can be modified (可以修改时返回true)
   */
  canBeModified(): boolean {
    return this.isDraft();
  }

  /**
   * Get the status value (获取状态值)
   *
   * @returns Status value string (状态值字符串)
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Check equality with another ContractStatus (检查与另一个ContractStatus是否相等)
   *
   * @param other - ContractStatus to compare (要比较的ContractStatus)
   * @returns true if values are equal (值相等时返回true)
   */
  equals(other: ContractStatus): boolean {
    return this.value === other.value;
  }

  /**
   * Get string representation (获取字符串表示)
   *
   * @returns Status value (状态值)
   */
  toString(): string {
    return this.value;
  }
}

/**
 * InvalidContractStatusException (无效合同状态异常)
 */
export class InvalidContractStatusException extends DomainException {
  constructor(status: string) {
    super(
      'INVALID_CONTRACT_STATUS',
      `Invalid contract status: ${status}`,
      { status },
    );
  }
}

/**
 * InvalidContractStatusTransitionException (无效合同状态转换异常)
 */
export class InvalidContractStatusTransitionException extends DomainException {
  constructor(from: string, to: string) {
    super(
      'INVALID_CONTRACT_STATUS_TRANSITION',
      `Invalid contract status transition from ${from} to ${to}`,
      { from, to },
    );
  }
}
