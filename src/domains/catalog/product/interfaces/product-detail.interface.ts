import { IProductItem } from "./product-item.interface";
import { IProduct } from "./product.interface";

/**
 * Product Detail Interface [产品详情接口]
 * Extends the base product interface with additional details
 */
export interface IProductDetail extends IProduct {
  /**
   * Product items [产品项列表]
   */
  items?: IProductItem[];
}
