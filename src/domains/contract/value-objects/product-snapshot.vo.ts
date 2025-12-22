/**
 * ProductSnapshot Value Object (产品快照值对象)
 * Anti-corruption layer to protect Contract domain from Catalog domain changes (防腐层，保护合同域免受目录域变更影响)
 * Stores frozen product data at contract creation time (存储合同创建时的产品快照数据)
 */

import { DomainException } from '@core/exceptions/domain.exception';

// Product item snapshot interface (产品项快照接口)
interface ProductItemSnapshot {
  productItemId: string;
  serviceTypeCode: string;
  quantity: number;
  sortOrder: number;
}

/**
 * ProductSnapshot Value Object (产品快照值对象)
 * Frozen snapshot of product data at contract creation time (合同创建时的产品数据快照)
 */
export class ProductSnapshot {
  private constructor(
    private readonly productId: string,
    private readonly productName: string,
    private readonly productCode: string,
    private readonly price: string, // Stored as string to preserve precision (使用字符串存储以保持精度)
    private readonly currency: string,
    private readonly validityDays: number | null,
    private readonly items: ProductItemSnapshot[],
    private readonly createdAt: Date,
  ) {}

  /**
   * Create a ProductSnapshot from Catalog domain Product (从目录域Product创建ProductSnapshot)
   *
   * @param product - Catalog domain product (目录域产品)
   * @returns ProductSnapshot instance (ProductSnapshot实例)
   */
  static fromProduct(product: {
    id: string;
    name: string;
    code: string;
    price: string;
    currency: string;
    validityDays?: number;
    items: Array<{ id: string; serviceTypeId: string; quantity: number; sortOrder: number }>;
  }): ProductSnapshot {
    return new ProductSnapshot(
      product.id,
      product.name,
      product.code,
      product.price,
      product.currency,
      product.validityDays ?? null,
      product.items.map((item) => ({
        productItemId: item.id,
        serviceTypeCode: item.serviceTypeId, // Assuming serviceTypeId is the code (假设serviceTypeId是编码)
        quantity: item.quantity,
        sortOrder: item.sortOrder,
      })),
      new Date(),
    );
  }

  /**
   * Reconstruct from persistence data (从持久化数据重建)
   *
   * @param data - Snapshot data (快照数据)
   * @returns ProductSnapshot instance (ProductSnapshot实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(data: {
    productId: string;
    productName: string;
    productCode: string;
    price: string;
    currency: string;
    validityDays?: number | null;
    items: ProductItemSnapshot[];
    snapshotAt: Date;
  }): ProductSnapshot {
    return new ProductSnapshot(
      data.productId,
      data.productName,
      data.productCode,
      data.price,
      data.currency,
      data.validityDays ?? null,
      data.items,
      data.snapshotAt,
    );
  }

  // Getters
  getProductId(): string {
    return this.productId;
  }

  getProductName(): string {
    return this.productName;
  }

  getProductCode(): string {
    return this.productCode;
  }

  getPrice(): string {
    return this.price;
  }

  getCurrency(): string {
    return this.currency;
  }

  getNumericPrice(): number {
    return parseFloat(this.price);
  }

  getValidityDays(): number | null {
    return this.validityDays;
  }

  getItems(): ProductItemSnapshot[] {
    return [...this.items]; // Return copy to maintain immutability (返回副本以保持不可变性)
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  /**
   * Get total quantity for a specific service type (获取特定服务类型的总数量)
   *
   * @param serviceTypeCode - Service type code (服务类型编码)
   * @returns Total quantity (总数量)
   */
  getTotalQuantityForServiceType(serviceTypeCode: string): number {
    return this.items
      .filter((item) => item.serviceTypeCode === serviceTypeCode)
      .reduce((total, item) => total + item.quantity, 0);
  }

  /**
   * Check if this snapshot is valid (检查快照是否有效)
   * Valid if it has at least one item (如果至少有一个item则有效)
   *
   * @returns true if valid (有效时返回true)
   */
  isValid(): boolean {
    return this.items.length > 0;
  }

  /**
   * Validate the snapshot (验证快照)
   *
   * @throws InvalidProductSnapshotException if snapshot is invalid (快照无效时抛出InvalidProductSnapshotException)
   */
  validate(): void {
    if (!this.isValid()) {
      throw new InvalidProductSnapshotException(
        this.productId,
        'Product snapshot must have at least one item',
      );
    }

    // Check for negative quantities (检查负数量)
    const hasNegativeQuantity = this.items.some((item) => item.quantity <= 0);
    if (hasNegativeQuantity) {
      throw new InvalidProductSnapshotException(
        this.productId,
        'All item quantities must be positive',
      );
    }
  }
}

/**
 * InvalidProductSnapshotException (无效产品快照异常)
 */
export class InvalidProductSnapshotException extends DomainException {
  constructor(productId: string, reason: string) {
    super(
      'INVALID_PRODUCT_SNAPSHOT',
      `Invalid product snapshot for product ${productId}: ${reason}`,
      { productId, reason },
    );
  }
}
