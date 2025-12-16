import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  Currency,
  MarketingLabel,
  ProductStatus,
  UserPersona,
} from "@shared/types/catalog-enums";

class ProductFaqResponseDto {
  @ApiProperty({
    description: "FAQ question. [常见问题-问题]",
    type: String,
    example: "What is included in this package?",
  })
  question!: string;

  @ApiProperty({
    description: "FAQ answer. [常见问题-答案]",
    type: String,
    example: "You will receive 4 sessions and 1 resume review.",
  })
  answer!: string;
}

class ProductMetadataResponseDto {
  @ApiPropertyOptional({
    description: "Key product features. [产品亮点]",
    type: [String],
    isArray: true,
  })
  features?: string[];

  @ApiPropertyOptional({
    description: "Frequently asked questions. [常见问题列表]",
    type: () => ProductFaqResponseDto,
    isArray: true,
  })
  faqs?: ProductFaqResponseDto[];

  @ApiPropertyOptional({
    description: "Deliverables. [交付物]",
    type: [String],
    isArray: true,
  })
  deliverables?: string[];

  @ApiPropertyOptional({
    description: "Marketing duration text. [展示用时长文本]",
    type: String,
    example: "4 weeks",
  })
  duration?: string;

  @ApiPropertyOptional({
    description: "Prerequisites. [前置条件/准备事项]",
    type: [String],
    isArray: true,
  })
  prerequisites?: string[];
}

export class ProductItemResponseDto {
  @ApiProperty({
    description: "Product item ID (UUID). [产品项ID(UUID)]",
    type: String,
    format: "uuid",
  })
  id!: string;

  @ApiProperty({
    description: "Product ID (UUID). [产品ID(UUID)]",
    type: String,
    format: "uuid",
  })
  productId!: string;

  @ApiProperty({
    description: "Service type ID (UUID). [服务类型ID(UUID)]",
    type: String,
    format: "uuid",
  })
  serviceTypeId!: string;

  @ApiProperty({
    description:
      "Service type code. Used for contract snapshots and entitlement aggregation. [服务类型编码，用于合同快照与权益汇总]",
    type: String,
    example: "resume_review",
  })
  serviceTypeCode!: string;

  @ApiProperty({
    description: "Service type name for display. [服务类型名称(展示用)]",
    type: String,
    example: "Resume Review",
  })
  serviceTypeName!: string;

  @ApiProperty({
    description: "Quantity included. [包含次数]",
    type: Number,
    example: 4,
  })
  quantity!: number;

  @ApiProperty({
    description: "Sort order. [展示排序]",
    type: Number,
    example: 0,
  })
  sortOrder!: number;

  @ApiProperty({
    description: "Created time (ISO 8601). [创建时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  createdAt!: string;

  @ApiProperty({
    description: "Updated time (ISO 8601). [更新时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  updatedAt!: string;
}

export class ProductResponseDto {
  @ApiProperty({
    description: "Product ID (UUID). [产品ID(UUID)]",
    type: String,
    format: "uuid",
  })
  id!: string;

  @ApiProperty({ description: "Product name. [产品名称]", type: String })
  name!: string;

  @ApiProperty({
    description: "Product code (unique). [产品编码(唯一)]",
    type: String,
  })
  code!: string;

  @ApiPropertyOptional({
    description: "Description. [描述]",
    type: String,
  })
  description?: string;

  @ApiPropertyOptional({
    description: "Cover image URL. [封面图URL]",
    type: String,
  })
  coverImage?: string;

  @ApiPropertyOptional({
    description: "Target user personas. [目标用户画像]",
    isArray: true,
    enum: UserPersona,
  })
  targetUserPersonas?: UserPersona[];

  @ApiProperty({
    description:
      "Price stored as decimal string (precision preserved). [价格(字符串，保留精度)]",
    type: String,
    example: "1999.00",
  })
  price!: string;

  @ApiProperty({
    description: "Currency. [币种]",
    enum: Currency,
    example: Currency.USD,
  })
  currency!: Currency;

  @ApiPropertyOptional({
    description: "Marketing labels. [营销标签]",
    isArray: true,
    enum: ["hot", "new", "recommended"],
  })
  marketingLabels?: MarketingLabel[];

  @ApiProperty({
    description: "Product status. [产品状态]",
    enum: ProductStatus,
    example: ProductStatus.DRAFT,
  })
  status!: ProductStatus;

  @ApiPropertyOptional({
    description: "Published time (ISO 8601). [发布时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  publishedAt?: string;

  @ApiPropertyOptional({
    description: "Unpublished time (ISO 8601). [下架时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  unpublishedAt?: string;

  @ApiPropertyOptional({
    description: "Metadata for display. [展示用元数据]",
    type: () => ProductMetadataResponseDto,
  })
  metadata?: ProductMetadataResponseDto;

  @ApiPropertyOptional({
    description: "Entitlement items. [权益项]",
    type: () => ProductItemResponseDto,
    isArray: true,
  })
  items?: ProductItemResponseDto[];

  @ApiProperty({
    description: "Created time (ISO 8601). [创建时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  createdAt!: string;

  @ApiProperty({
    description: "Updated time (ISO 8601). [更新时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  updatedAt!: string;

  @ApiProperty({
    description: "Created by user ID (UUID). [创建人用户ID(UUID)]",
    type: String,
    format: "uuid",
  })
  createdBy!: string;
}

class ProductSnapshotItemResponseDto {
  @ApiProperty({
    description: "Service type ID (UUID). [服务类型ID(UUID)]",
    type: String,
    format: "uuid",
  })
  serviceTypeId!: string;

  @ApiProperty({
    description: "Service type code. [服务类型编码]",
    type: String,
    example: "resume_review",
  })
  serviceTypeCode!: string;

  @ApiProperty({
    description: "Quantity included. [包含次数]",
    type: Number,
    example: 4,
  })
  quantity!: number;
}

export class ProductSnapshotResponseDto {
  @ApiProperty({
    description: "Product ID (UUID). [产品ID(UUID)]",
    type: String,
    format: "uuid",
  })
  productId!: string;

  @ApiProperty({ description: "Product name. [产品名称]", type: String })
  productName!: string;

  @ApiProperty({ description: "Product code. [产品编码]", type: String })
  productCode!: string;

  @ApiProperty({
    description:
      "Price at snapshot time (decimal string). [快照价格(字符串)]",
    type: String,
    example: "1999.00",
  })
  price!: string;

  @ApiProperty({
    description: "Currency at snapshot time. [快照币种]",
    enum: Currency,
  })
  currency!: Currency;

  @ApiProperty({
    description: "Snapshot items. [快照权益项]",
    type: () => ProductSnapshotItemResponseDto,
    isArray: true,
  })
  items!: ProductSnapshotItemResponseDto[];

  @ApiProperty({
    description: "Snapshot time (ISO 8601). [快照时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  snapshotAt!: string;
}

export class ProductDetailResponseDto extends ProductResponseDto {
  @ApiProperty({
    description:
      "Enriched entitlement items with service type code/name. [带服务类型编码/名称的权益项]",
    type: () => ProductItemResponseDto,
    isArray: true,
  })
  items!: ProductItemResponseDto[];
}

