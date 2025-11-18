import {
  Currency,
  MarketingLabel,
  ProductStatus,
  UserPersona
} from "@shared/types/catalog-enums";

// Product 基础接口
export interface IProduct {
  id: string;
  name: string;
  code: string;
  description?: string;
  coverImage?: string;
  targetUserTypes?: UserPersona[];
  price: string; // Decimal stored as string
  currency: Currency;
  validityDays?: number;
  marketingLabels?: MarketingLabel[];
  status: ProductStatus;
  scheduledPublishAt?: Date;
  publishedAt?: Date;
  unpublishedAt?: Date;
  sortOrder: number;
  metadata?: {
    features?: string[];
    faqs?: Array<{
      question: string;
      answer: string;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  publishedBy?: string;
  unpublishedBy?: string;
}
