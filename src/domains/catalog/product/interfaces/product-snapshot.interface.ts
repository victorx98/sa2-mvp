import { Currency } from "@shared/types/catalog-enums";

// Product snapshot item (simplified without service/service package references)
export interface IProductSnapshotItem {
  serviceTypeId: string;
  serviceTypeCode: string; // Service type code [服务类型编码]
  quantity: number; // All services are billed by times (次数)
}

// Product snapshot interface (used for contracts)
export interface IProductSnapshot {
  productId: string;
  productName: string;
  productCode: string;
  price: string;
  currency: Currency;
  items: IProductSnapshotItem[];
  snapshotAt: Date;
}
