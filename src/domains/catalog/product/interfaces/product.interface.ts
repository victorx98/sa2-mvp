import {
  ProductStatus,
  Currency,
  UserType,
  MarketingLabel,
} from "../../common/interfaces/enums";

// Product 基础接口
export interface IProduct {
  id: string;
  name: string;
  code: string;
  description?: string;
  coverImage?: string;
  targetUserTypes?: UserType[];
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
