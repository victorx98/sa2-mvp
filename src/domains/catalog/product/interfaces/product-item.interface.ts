/**
 * Product Item Interface [产品项接口]
 * Represents an item within a product
 * [表示产品中的项目]
 */
export interface IProductItem {
  /**
   * Item ID [项ID]
   */
  id: string;

  /**
   * Product ID [产品ID]
   */
  productId: string;

  /**
   * Service type ID [服务类型ID]
   */
  serviceTypeId: string;

  /**
   * Item quantity [项数量]
   */
  quantity: number;

  /**
   * Sort order [排序序号]
   */
  sortOrder: number;

  /**
   * Created timestamp [创建时间]
   */
  createdAt: Date;

  /**
   * Updated timestamp [更新时间]
   */
  updatedAt: Date;
}
