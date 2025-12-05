import {
  Currency,
  MarketingLabel,
  ProductStatus,
  UserPersona,
} from "@shared/types/catalog-enums";
import { IProductItem } from "./product-item.interface";

/**
 * Product Interface [产品接口]
 * Represents the base product entity [表示基础产品实体]
 */
export interface IProduct {
  id: string;
  name: string;
  code: string;
  description?: string;
  coverImage?: string;
  targetUserPersonas?: UserPersona[];
  price: string; // Decimal stored as string [十进制存储为字符串]
  currency: Currency;
  marketingLabels?: MarketingLabel[];
  status: ProductStatus;
  publishedAt?: Date;
  unpublishedAt?: Date;
  metadata?: {
    features?: string[];
    faqs?: Array<{
      question: string;
      answer: string;
    }>;
    deliverables?: string[];
    duration?: string;
    prerequisites?: string[];
  };
  items?: IProductItem[]; // Product items [产品项]
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
