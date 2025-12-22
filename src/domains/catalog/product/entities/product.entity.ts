/**
 * Product Entity (产品实体)
 * Aggregate root for the Product aggregate (Product聚合的聚合根)
 * Manages product lifecycle and constraints (管理产品生命周期和约束条件)
 */

import { v4 as uuidv4 } from 'uuid';
import { Price, ProductCode, ProductStatus, Currency } from '../value-objects';
import { ProductItem } from './product-item.entity';
import {
  ProductNotDraftException,
  ProductMinItemsException,
  ProductNotActiveException,
  DuplicateServiceTypeException,
  ProductItemNotFoundException,
} from '../exceptions';

// Product metadata interface (产品元数据接口)
interface ProductMetadata {
  features?: string[];
  faqs?: Array<{ question: string; answer: string }>;
  deliverables?: string[];
  duration?: string;
  prerequisites?: string[];
}

// Product properties interface (产品属性接口)
interface ProductProps {
  id: string;
  name: string;
  code: ProductCode;
  description?: string;
  price: Price;
  currency: string;
  coverImage?: string;
  targetUserPersona?: string[];
  marketingLabels?: string[];
  status: ProductStatus;
  items: ProductItem[];
  metadata?: ProductMetadata;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
  publishedAt?: Date;
  unpublishedAt?: Date;
}

export class Product {
  private constructor(private readonly props: ProductProps) {}

  /**
   * Create a new draft product (创建新的草稿产品)
   * Factory method for creating new products (创建新产品的工厂方法)
   *
   * @param id - Product ID (产品ID)
   * @param name - Product name (产品名称)
   * @param code - Product code (产品编码)
   * @param price - Product price (产品价格)
   * @param createdBy - Creator user ID (创建人ID)
   * @param description - Optional description (可选描述)
   * @returns Product instance (Product实例)
   */
  static createDraft(
    id: string,
    name: string,
    code: string | ProductCode,
    price: number | Price,
    createdBy: string,
    description?: string,
  ): Product {
    // Convert string code to ProductCode if needed (如需要，将字符串编码转换为ProductCode)
    const productCode = typeof code === 'string' ? ProductCode.create(code) : code;

    // Convert number price to Price if needed (如需要，将数字价格转换为Price)
    const productPrice = price instanceof Price ? price : Price.create(price, Currency.CNY);

    const product = new Product({
      id,
      name,
      code: productCode,
      description,
      price: productPrice,
      currency: 'CNY',
      status: ProductStatus.DRAFT,
      items: [],
      createdAt: new Date(),
      createdBy,
    });

    return product;
  }

  /**
   * Reconstruct a Product from persistence (从持久化数据重建Product)
   *
   * @param props - Product properties (产品属性)
   * @returns Product instance (Product实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(props: ProductProps): Product {
    return new Product(props);
  }

  /**
   * Publish the product (发布产品)
   * Only DRAFT products with at least one item can be published (只有至少包含一个item的DRAFT产品可以发布)
   *
   * @throws ProductNotDraftException if product is not in DRAFT status (产品不处于DRAFT状态时抛出ProductNotDraftException)
   * @throws ProductMinItemsException if product has no items (产品没有items时抛出ProductMinItemsException)
   */
  publish(): void {
    if (!this.props.status.isDraft()) {
      throw new ProductNotDraftException(this.props.id);
    }

    if (this.props.items.length === 0) {
      throw new ProductMinItemsException(this.props.id);
    }

    (this.props as any).status = this.props.status.transitionToActive();
    (this.props as any).publishedAt = new Date();
  }

  /**
   * Unpublish the product (下架产品)
   * Only ACTIVE products can be unpublished (只有ACTIVE产品可以下架)
   *
   * @throws ProductNotActiveException if product is not in ACTIVE status (产品不处于ACTIVE状态时抛出ProductNotActiveException)
   */
  unpublish(): void {
    if (!this.props.status.isActive()) {
      throw new ProductNotActiveException(this.props.id, this.props.status.getValue());
    }

    (this.props as any).status = this.props.status.transitionToInactive();
    (this.props as any).unpublishedAt = new Date();
  }

  /**
   * Update product information (更新产品信息)
   * Only DRAFT products can be updated (只有DRAFT产品可以更新)
   *
   * @param name - New name (optional) (新名称，可选)
   * @param description - New description (optional) (新描述，可选)
   * @param price - New price (optional) (新价格，可选)
   * @param updatedBy - Updater user ID (更新人ID)
   * @throws ProductNotDraftException if product is not in DRAFT status (产品不处于DRAFT状态时抛出ProductNotDraftException)
   */
  update(
    updatedBy: string,
    name?: string,
    description?: string
  ): void {
    if (!this.props.status.canBeUpdated()) {
      throw new ProductNotDraftException(this.props.id);
    }

    if (name !== undefined) {
      (this.props as any).name = name;
    }

    if (description !== undefined) {
      (this.props as any).description = description;
    }

    (this.props as any).updatedAt = new Date();
    (this.props as any).updatedBy = updatedBy;
  }

  /**
   * Add a product item (添加产品项)
   * Validation: Cannot add duplicate service types (验证：不能添加重复的服务类型)
   *
   * @param item - ProductItem to add (要添加的ProductItem)
   * @throws DuplicateServiceTypeException if service type already exists (服务类型已存在时抛出DuplicateServiceTypeException)
   */
  addItem(item: ProductItem): void {
    // Check for duplicates (检查是否重复)
    const existingItem = this.props.items.find(i =>
      i.isForServiceType(item.getServiceTypeId())
    );

    if (existingItem) {
      throw new DuplicateServiceTypeException(
        this.props.id,
        item.getServiceTypeId()
      );
    }

    (this.props as any).items = [...this.props.items, item];
  }

  /**
   * Remove a product item (移除产品项)
   * Validation: Cannot remove all items from DRAFT products (验证：不能从DRAFT产品移除所有items)
   *
   * @param itemId - ID of the item to remove (要移除的item的ID)
   * @throws ProductItemNotFoundException if item does not exist (item不存在时抛出ProductItemNotFoundException)
   * @throws ProductMinItemsException if this would remove the last item (将要移除最后一个item时抛出ProductMinItemsException)
   */
  removeItem(itemId: string): void {
    const itemIndex = this.props.items.findIndex(i => i.getId() === itemId);

    if (itemIndex === -1) {
      throw new ProductItemNotFoundException(this.props.id, itemId);
    }

    // Check if removing the last item (检查是否移除最后一个item)
    if (this.props.status.isDraft() && this.props.items.length === 1) {
      throw new ProductMinItemsException(this.props.id);
    }

    (this.props as any).items = this.props.items.filter(
      i => i.getId() !== itemId
    );
  }

  /**
   * Get product item by ID (根据ID获取产品项)
   *
   * @param itemId - Item ID (item ID)
   * @returns ProductItem or undefined (ProductItem或undefined)
   */
  getItemById(itemId: string): ProductItem | undefined {
    return this.props.items.find(i => i.getId() === itemId);
  }

  /**
   * Check if product has a specific service type (检查产品是否包含特定服务类型)
   *
   * @param serviceTypeId - Service type ID (服务类型ID)
   * @returns true if product includes the service type (包含服务类型时返回true)
   */
  hasServiceType(serviceTypeId: string): boolean {
    return this.props.items.some(i => i.isForServiceType(serviceTypeId));
  }

  // Getters
  getId(): string {
    return this.props.id;
  }

  getName(): string {
    return this.props.name;
  }

  getCode(): ProductCode {
    return this.props.code;
  }

  getDescription(): string | undefined {
    return this.props.description;
  }

  getPrice(): Price {
    return this.props.price;
  }

  getCurrency(): string {
    return this.props.currency;
  }

  getCoverImage(): string | undefined {
    return this.props.coverImage;
  }

  getTargetUserPersona(): string[] | undefined {
    return this.props.targetUserPersona;
  }

  getMarketingLabels(): string[] | undefined {
    return this.props.marketingLabels;
  }

  getStatus(): ProductStatus {
    return this.props.status;
  }

  getItems(): ProductItem[] {
    return this.props.items;
  }

  getMetadata(): ProductMetadata | undefined {
    return this.props.metadata;
  }

  getCreatedAt(): Date {
    return this.props.createdAt;
  }

  getCreatedBy(): string {
    return this.props.createdBy;
  }

  getUpdatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  getUpdatedBy(): string | undefined {
    return this.props.updatedBy;
  }

  getPublishedAt(): Date | undefined {
    return this.props.publishedAt;
  }

  getUnpublishedAt(): Date | undefined {
    return this.props.unpublishedAt;
  }

  /**
   * Check if product can be published (检查产品是否可以发布)
   *
   * @returns true if product is in DRAFT status and has items (产品处于DRAFT状态且有items时返回true)
   */
  canBePublished(): boolean {
    return this.props.status.isDraft() && this.props.items.length > 0;
  }
}

/**
 * ProductNotDraftException (产品不是草稿异常)
 * Thrown when attempting an operation that requires DRAFT status (尝试需要DRAFT状态的操作时抛出)
 */
