/**
 * Product Read Models
 * 产品查询输出模型
 */

export interface ProductItemReadModel {
  id: string;
  productId: string;
  serviceTypeId: string;
  serviceTypeCode: string | null;
  serviceTypeName: string | null;
  packageCode: string | null;
  quantity: number;
  note: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductReadModel {
  id: string;
  name: string;
  code: string | null;
  status: string;
  price: number;
  currency: string;
  userPersona: string | null;
  marketingLabel: string | null;
  isRecommended: boolean;
  recommendPriority: number | null;
  availableFrom: Date | null;
  availableTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  items?: ProductItemReadModel[];
}

export interface ProductDetailReadModel extends ProductReadModel {
  items: ProductItemReadModel[];
}

