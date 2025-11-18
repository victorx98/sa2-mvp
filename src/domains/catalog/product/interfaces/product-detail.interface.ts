import { IProduct } from "./product.interface";
import { IService } from "../../service/interfaces/service.interface";
import { IServicePackage } from "../../service-package/interfaces/service-package.interface";
import { ProductItemType } from "@shared/types/catalog-enums";

// Product detail interface (includes product items)
export interface IProductItem {
  id: string;
  type: ProductItemType;
  referenceId: string;
  quantity: number;
  sortOrder: number;
  // Associated data (optional)
  service?: IService;
  servicePackage?: IServicePackage;
}

export interface IProductDetail extends IProduct {
  items?: IProductItem[]; // Product items in the product
}
