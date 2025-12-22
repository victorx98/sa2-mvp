import { DomainException } from '@core/exceptions/domain.exception';

/**
 * ProductStatus Value Object (产品状态值对象)
 * State machine for product lifecycle management (产品生命周期管理状态机)
 */
export class ProductStatus {
  private static readonly STATUSES = {
    DRAFT: 'DRAFT',         // Initial state, not ready for sale (初始状态，不可销售)
    ACTIVE: 'ACTIVE',       // Published and available for purchase (已发布，可购买)
    INACTIVE: 'INACTIVE',   // Taken offline, not available (已下架，不可购买)
    DELETED: 'DELETED',     // Soft deleted (软删除)
  };

  static DRAFT = new ProductStatus(ProductStatus.STATUSES.DRAFT);
  static ACTIVE = new ProductStatus(ProductStatus.STATUSES.ACTIVE);
  static INACTIVE = new ProductStatus(ProductStatus.STATUSES.INACTIVE);
  static DELETED = new ProductStatus(ProductStatus.STATUSES.DELETED);

  private readonly transitions: Map<string, string[]> = new Map([
    [ProductStatus.STATUSES.DRAFT, [ProductStatus.STATUSES.ACTIVE, ProductStatus.STATUSES.DELETED]],
    [ProductStatus.STATUSES.ACTIVE, [ProductStatus.STATUSES.INACTIVE]],
    [ProductStatus.STATUSES.INACTIVE, [ProductStatus.STATUSES.ACTIVE]],
    [ProductStatus.STATUSES.DELETED, []],  // Deleted is final state (DELETED是最终状态)
  ]);

  private constructor(private readonly value: string) {}

  /**
   * Factory method to create a ProductStatus (创建ProductStatus的工厂方法)
   *
   * @param value - Status value string (状态值字符串)
   * @returns ProductStatus instance (ProductStatus实例)
   * @throws InvalidProductStatusException if value is invalid (值无效时抛出InvalidProductStatusException)
   */
  static fromString(value: string): ProductStatus {
    switch (value.toUpperCase()) {
      case this.STATUSES.DRAFT:
        return this.DRAFT;
      case this.STATUSES.ACTIVE:
        return this.ACTIVE;
      case this.STATUSES.INACTIVE:
        return this.INACTIVE;
      case this.STATUSES.DELETED:
        return this.DELETED;
      default:
        throw new InvalidProductStatusException(value);
    }
  }

  /**
   * Private factory method for reconstruction (私有工厂方法，用于重建)
   *
   * @param value - Status value string (状态值字符串)
   * @returns ProductStatus instance (ProductStatus实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(value: string): ProductStatus {
    return new ProductStatus(value);
  }

  /**
   * Transition to ACTIVE state (转换到ACTIVE状态)
   * Valid transitions: DRAFT → ACTIVE, INACTIVE → ACTIVE (有效转换：DRAFT → ACTIVE, INACTIVE → ACTIVE)
   *
   * @returns ACTIVE status (ACTIVE状态)
   * @throws InvalidStatusTransitionException if transition is invalid (转换无效时抛出InvalidStatusTransitionException)
   */
  transitionToActive(): ProductStatus {
    if (!this.canTransitionTo(ProductStatus.ACTIVE.value)) {
      throw new InvalidStatusTransitionException(
        this.value,
        ProductStatus.ACTIVE.value,
      );
    }
    return ProductStatus.ACTIVE;
  }

  /**
   * Transition to INACTIVE state (转换到INACTIVE状态)
   * Valid transition: ACTIVE → INACTIVE (有效转换：ACTIVE → INACTIVE)
   *
   * @returns INACTIVE status (INACTIVE状态)
   * @throws InvalidStatusTransitionException if transition is invalid (转换无效时抛出InvalidStatusTransitionException)
   */
  transitionToInactive(): ProductStatus {
    if (!this.canTransitionTo(ProductStatus.INACTIVE.value)) {
      throw new InvalidStatusTransitionException(
        this.value,
        ProductStatus.INACTIVE.value,
      );
    }
    return ProductStatus.INACTIVE;
  }

  /**
   * Check if can transition to target state (检查是否可以转换到目标状态)
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
    return this.value === ProductStatus.STATUSES.DRAFT;
  }

  /**
   * Check if current status is ACTIVE (检查当前状态是否为ACTIVE)
   *
   * @returns true if status is ACTIVE (状态为ACTIVE时返回true)
   */
  isActive(): boolean {
    return this.value === ProductStatus.STATUSES.ACTIVE;
  }

  /**
   * Check if current status is INACTIVE (检查当前状态是否为INACTIVE)
   *
   * @returns true if status is INACTIVE (状态为INACTIVE时返回true)
   */
  isInactive(): boolean {
    return this.value === ProductStatus.STATUSES.INACTIVE;
  }

  /**
   * Check if current status is DELETED (检查当前状态是否为DELETED)
   *
   * @returns true if status is DELETED (状态为DELETED时返回true)
   */
  isDeleted(): boolean {
    return this.value === ProductStatus.STATUSES.DELETED;
  }

  /**
   * Check if product can be updated (检查产品是否可以更新)
   * Only DRAFT status products can be updated (只有DRAFT状态的产品可以更新)
   *
   * @returns true if can be updated (可以更新时返回true)
   */
  canBeUpdated(): boolean {
    return this.isDraft();
  }

  /**
   * Check if product can be published (检查产品是否可以发布)
   * Only DRAFT status products can be published (只有DRAFT状态的产品可以发布)
   *
   * @returns true if can be published (可以发布时返回true)
   */
  canBePublished(): boolean {
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
   * Check equality with another ProductStatus (检查与另一个ProductStatus是否相等)
   *
   * @param other - ProductStatus to compare (要比较的ProductStatus)
   * @returns true if values are equal (值相等时返回true)
   */
  equals(other: ProductStatus): boolean {
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
 * InvalidProductStatusException (无效产品状态异常)
 */
export class InvalidProductStatusException extends DomainException {
  constructor(status: string) {
    super(
      'INVALID_PRODUCT_STATUS',
      `Invalid product status: ${status}`,
      { status },
    );
  }
}

/**
 * InvalidStatusTransitionException (无效状态转换异常)
 */
export class InvalidStatusTransitionException extends DomainException {
  constructor(from: string, to: string) {
    super(
      'INVALID_STATUS_TRANSITION',
      `Invalid status transition from ${from} to ${to}`,
      { from, to },
    );
  }
}
