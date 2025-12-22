/**
 * ServiceQuantity Value Object (服务数量值对象)
 * Represents service type and quantity pair (表示服务类型和数量的配对)
 */

import { DomainException } from '@core/exceptions/domain.exception';

export class ServiceQuantity {
  private constructor(
    private readonly serviceTypeCode: string,
    private readonly quantity: number,
  ) {}

  /**
   * Create a ServiceQuantity (创建ServiceQuantity)
   *
   * @param serviceTypeCode - Service type code (e.g., 'ONE_ON_ONE', 'MOCK_INTERVIEW') (服务类型编码)
   * @param quantity - Number of services (服务数量)
   * @returns ServiceQuantity instance (ServiceQuantity实例)
   * @throws InvalidServiceQuantityException if quantity is not positive (数量不是正数时抛出InvalidServiceQuantityException)
   */
  static create(serviceTypeCode: string, quantity: number): ServiceQuantity {
    if (quantity <= 0) {
      throw new InvalidServiceQuantityException(serviceTypeCode, quantity);
    }

    return new ServiceQuantity(serviceTypeCode, quantity);
  }

  /**
   * Reconstruct from persistence data (从持久化数据重建)
   *
   * @param serviceTypeCode - Service type code (服务类型编码)
   * @param quantity - Service quantity (服务数量)
   * @returns ServiceQuantity instance (ServiceQuantity实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(serviceTypeCode: string, quantity: number): ServiceQuantity {
    return new ServiceQuantity(serviceTypeCode, quantity);
  }

  // Getters
  getServiceTypeCode(): string {
    return this.serviceTypeCode;
  }

  getQuantity(): number {
    return this.quantity;
  }

  /**
   * Add quantity (增加数量)
   *
   * @param amount - Amount to add (要增加的数量)
   * @returns New ServiceQuantity with updated quantity (返回更新数量后的新ServiceQuantity)
   */
  add(amount: number): ServiceQuantity {
    return ServiceQuantity.create(this.serviceTypeCode, this.quantity + amount);
  }

  /**
   * Subtract quantity (减少数量)
   *
   * @param amount - Amount to subtract (要减少的数量)
   * @returns New ServiceQuantity with updated quantity (返回更新数量后的新ServiceQuantity)
   * @throws InvalidServiceQuantityException if result is not positive (结果不是正数时抛出InvalidServiceQuantityException)
   */
  subtract(amount: number): ServiceQuantity {
    return ServiceQuantity.create(this.serviceTypeCode, this.quantity - amount);
  }

  /**
   * Check if this represents the same service type (检查是否代表相同的服务类型)
   *
   * @param serviceTypeCode - Service type code to compare (要比较的服务类型编码)
   * @returns true if service types match (服务类型匹配时返回true)
   */
  isForServiceType(serviceTypeCode: string): boolean {
    return this.serviceTypeCode === serviceTypeCode;
  }

  /**
   * Check equality with another ServiceQuantity (检查与另一个ServiceQuantity是否相等)
   *
   * @param other - ServiceQuantity to compare (要比较的ServiceQuantity)
   * @returns true if both service type and quantity are equal (服务类型和数量都相等时返回true)
   */
  equals(other: ServiceQuantity): boolean {
    return (
      this.serviceTypeCode === other.serviceTypeCode &&
      this.quantity === other.quantity
    );
  }

  /**
   * Check if quantity is sufficient (检查数量是否充足)
   *
   * @param required - Required quantity (所需数量)
   * @returns true if current quantity >= required (当前数量 >= 所需数量时返回true)
   */
  isSufficient(required: number): boolean {
    return this.quantity >= required;
  }
}

/**
 * InvalidServiceQuantityException (无效服务数量异常)
 */
export class InvalidServiceQuantityException extends DomainException {
  constructor(serviceTypeCode: string, quantity: number) {
    super(
      'INVALID_SERVICE_QUANTITY',
      `Invalid service quantity for ${serviceTypeCode}: ${quantity}. Must be a positive number`,
      { serviceTypeCode, quantity },
    );
  }
}
