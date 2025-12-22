import { Product } from '../entities';
import { ProductCode } from '../value-objects';

/**
 * Product Search Criteria (产品查询条件)
 * Defines filtering options for product search operations (定义产品查询操作的过滤选项)
 */
export interface ProductSearchCriteria {
  /** Filter by status (按状态过滤) */
  status?: string;

  /** Filter by name containing text (按名称包含文本过滤) */
  nameContains?: string;

  /** Filter by code containing text (按编码包含文本过滤) */
  codeContains?: string;

  /** Filter by product ID (按产品ID过滤) */
  productId?: string;

  /** Page number for pagination (分页页码) */
  page?: number;

  /** Page size for pagination (分页大小) */
  pageSize?: number;

  /** Sort field (排序字段) */
  sortBy?: string;

  /** Sort order (ASC/DESC) (排序顺序) */
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Product Search Result (产品查询结果)
 * Contains paginated product data (包含分页的产品数据)
 */
export interface ProductSearchResult {
  /** Array of products (产品数组) */
  products: Product[];

  /** Total number of products matching the criteria (符合查询条件的总产品数) */
  total: number;

  /** Current page number (当前页码) */
  page: number;

  /** Page size (分页大小) */
  pageSize: number;

  /** Total number of pages (总页数) */
  totalPages: number;
}

/**
 * Dependency Injection Token for IProductRepository (IProductRepository的依赖注入令牌)
 */
export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

/**
 * Product Repository Interface (产品仓储接口)
 * Defines data access operations for Product aggregate (定义Product聚合的数据访问操作)
 */
export interface IProductRepository {
  /**
   * Find product by ID (通过ID查找产品)
   *
   * @param id - Product ID (产品ID)
   * @returns Product or null if not found (产品实例或null)
   */
  findById(id: string): Promise<Product | null>;

  /**
   * Find product by unique code (通过唯一编码查找产品)
   *
   * @param code - Product code (产品编码)
   * @returns Product or null if not found (产品实例或null)
   */
  findByCode(code: ProductCode): Promise<Product | null>;

  /**
   * Check if a product with the given code exists (检查是否存在指定编码的产品)
   *
   * @param code - Product code to check (要检查的产品编码)
   * @returns true if product exists (存在时返回true)
   */
  existsByCode(code: ProductCode): Promise<boolean>;

  /**
   * Search products by criteria (根据条件搜索产品)
   *
   * @param criteria - Search criteria (查询条件)
   * @returns Search result with products (包含产品的查询结果)
   */
  search(criteria: ProductSearchCriteria): Promise<ProductSearchResult>;

  /**
   * Save a new product (保存新产品)
   *
   * @param product - Product to save (要保存的产品)
   * @returns Saved product (已保存的产品)
   */
  save(product: Product): Promise<Product>;

  /**
   * Update an existing product (更新现有产品)
   *
   * @param product - Product to update (要更新的产品)
   * @returns Updated product (更新后的产品)
   */
  update(product: Product): Promise<Product>;

  /**
   * Delete a product (soft delete) (删除产品（软删除）)
   *
   * @param id - Product ID (产品ID)
   * @param deletedBy - User ID who performed the deletion (执行删除操作的用户ID)
   */
  delete(id: string, deletedBy: string): Promise<void>;

  /**
   * Execute operations within a transaction (在事务中执行操作)
   *
   * @param fn - Function to execute within transaction (要在事务中执行的函数)
   * @returns Result of the transaction function (事务函数的结果)
   */
  withTransaction<T>(fn: (repo: IProductRepository) => Promise<T>): Promise<T>;
}
