import { IServiceSnapshot } from "../../service/interfaces/service-snapshot.interface";
import { IServicePackageSnapshot } from "../../service-package/interfaces/service-package-snapshot.interface";
import {
  ProductItemType,
  ServiceUnit,
  Currency,
} from "../../common/interfaces/enums";

// Product snapshot item (with expanded service packages)
export interface IProductSnapshotItem {
  type: ProductItemType;
  quantity: number;
  unit: ServiceUnit;
  sortOrder: number;
  // Service or service package snapshot
  serviceSnapshot?: IServiceSnapshot;
  servicePackageSnapshot?: IServicePackageSnapshot;
}

// Product snapshot interface (used for contracts)
export interface IProductSnapshot {
  productId: string;
  productName: string;
  productCode: string;
  price: string;
  currency: Currency;
  validityDays?: number;
  items: IProductSnapshotItem[];
  snapshotAt: Date;
}
