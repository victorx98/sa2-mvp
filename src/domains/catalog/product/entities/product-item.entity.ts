/**
 * ProductItem Entity (产品项实体)
 * Represents a service type included in a product (代表产品中包含的服务类型)
 * This is a child entity within the Product aggregate (Product聚合中的子实体)
 */

import { v4 as uuidv4 } from 'uuid';
import { DomainException } from '@core/exceptions/domain.exception';

export interface ProductItemProps {
  id: string;
  productId: string;
  serviceTypeId: string;
  quantity: number;
  sortOrder: number;
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export class ProductItem {
  private constructor(private readonly props: ProductItemProps) {}

  /**
   * Create a new ProductItem (创建新的ProductItem)
   *
   * @param productId - Parent product ID (所属产品ID)
   * @param serviceTypeId - Service type ID (服务类型ID)
   * @param quantity - Quantity of the service type (服务类型的数量)
   * @param createdBy - Creator user ID (创建人ID)
   * @param sortOrder - Sort order (optional) (排序序号，可选)
   * @returns ProductItem instance (ProductItem实例)
   * @throws InvalidQuantityException if quantity is not positive (数量不是正数时抛出InvalidQuantityException)
   */
  static create(
    productId: string,
    serviceTypeId: string,
    quantity: number,
    createdBy: string,
    sortOrder: number = 0,
  ): ProductItem {
    if (quantity <= 0) {
      throw new InvalidQuantityException(quantity);
    }

    return new ProductItem({
      id: uuidv4(),
      productId,
      serviceTypeId,
      quantity,
      sortOrder,
      createdAt: new Date(),
      createdBy,
    });
  }

  /**
   * Reconstruct a ProductItem from persistence (从持久化数据重建ProductItem)
   *
   * @param props - ProductItem properties (ProductItem属性)
   * @returns ProductItem instance (ProductItem实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(props: ProductItemProps): ProductItem {
    return new ProductItem(props);
  }

  /**
   * Update quantity (更新数量)
   *
   * @param newQuantity - New quantity (新数量)
   * @param updatedBy - Updater user ID (更新人ID)
   * @throws InvalidQuantityException if quantity is not positive (数量不是正数时抛出InvalidQuantityException)
   */
  updateQuantity(newQuantity: number, updatedBy: string): void {
    if (newQuantity <= 0) {
      throw new InvalidQuantityException(newQuantity);
    }

    (this.props as any).quantity = newQuantity;
    (this.props as any).updatedAt = new Date();
    (this.props as any).updatedBy = updatedBy;
  }

  /**
   * Update sort order (更新排序序号)
   *
   * @param newSortOrder - New sort order (新的排序序号)
   * @param updatedBy - Updater user ID (更新人ID)
   */
  updateSortOrder(newSortOrder: number, updatedBy: string): void {
    (this.props as any).sortOrder = newSortOrder;
    (this.props as any).updatedAt = new Date();
    (this.props as any).updatedBy = updatedBy;
  }

  /**
   * Check if this item is for a specific service type (检查此项是否为指定的服务类型)
   *
   * @param serviceTypeId - Service type ID to check (要检查的服务类型ID)
   * @returns true if this item is for the specified service type (为此服务类型时返回true)
   */
  isForServiceType(serviceTypeId: string): boolean {
    return this.props.serviceTypeId === serviceTypeId;
  }

  // Getters
  getId(): string {
    return this.props.id;
  }

  getProductId(): string {
    return this.props.productId;
  }

  getServiceTypeId(): string {
    return this.props.serviceTypeId;
  }

  getQuantity(): number {
    return this.props.quantity;
  }

  getSortOrder(): number {
    return this.props.sortOrder;
  }

  getCreatedAt(): Date {
    return this.props.createdAt;
  }

  getCreatedBy(): string | undefined {
    return this.props.createdBy;
  }

  getUpdatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  getUpdatedBy(): string | undefined {
    return this.props.updatedBy;
  }

  /**
   * Check equality with another ProductItem (检查与另一个ProductItem是否相等)
   *
   * @param other - ProductItem to compare (要比较的ProductItem)
   * @returns true if IDs are equal (ID相等时返回true)
   */
  equals(other: ProductItem): boolean {
    return this.props.id === other.props.id;
  }
}

/**
 * InvalidQuantityException (无效数量异常)
 * Thrown when quantity is not a positive integer (数量不是正整数时抛出)
 */
export class InvalidQuantityException extends DomainException {
  constructor(quantity: number) {
    super(
      'INVALID_QUANTITY',
      `Invalid quantity: ${quantity}. Quantity must be a positive integer`,
      { quantity },
    );
  }
}
