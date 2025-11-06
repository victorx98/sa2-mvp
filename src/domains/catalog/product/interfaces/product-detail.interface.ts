import { IProduct } from "./product.interface";
import { IService } from "../../service/interfaces/service.interface";
import { IServicePackage } from "../../service-package/interfaces/service-package.interface";
import { ProductItemType, ServiceUnit } from "../../common/interfaces/enums";

// Product detail interface (includes product items)
export interface IProductItem {
  id: string;
  type: ProductItemType;
  referenceId: string;
  quantity: number;
  unit: ServiceUnit;
  sortOrder: number;
  // Associated data (optional)
  service?: IService;
  servicePackage?: IServicePackage;
}

export interface IProductDetail extends IProduct {
  items?: IProductItem[]; // Product items in the product
}
