/**
 * Product Query Repository Interface
 * 产品查询仓储接口
 */
import { IPaginatedResult } from '@shared/types/paginated-result';
import { ProductReadModel, ProductDetailReadModel } from '../models/product-read.model';
import { SearchProductsDto, GetProductDetailDto } from '../dto/product-query.dto';

/**
 * DI Token for Product Query Repository
 */
export const PRODUCT_QUERY_REPOSITORY = Symbol('PRODUCT_QUERY_REPOSITORY');

/**
 * Product Query Repository Interface
 */
export interface IProductQueryRepository {
  /**
   * Search products with filters, pagination and sorting
   * 
   * @param dto - Query input
   * @returns Paginated product results
   */
  searchProducts(dto: SearchProductsDto): Promise<IPaginatedResult<ProductReadModel>>;

  /**
   * Get product detail by ID
   * 
   * @param dto - Query input with product ID
   * @returns Product detail with items
   */
  getProductDetail(dto: GetProductDetailDto): Promise<ProductDetailReadModel | null>;
}

