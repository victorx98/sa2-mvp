import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  Currency,
  MarketingLabel,
  ProductStatus,
  UserPersona,
} from "@shared/types/catalog-enums";

const MARKETING_LABEL_VALUES = ["hot", "new", "recommended"] as const;

class ProductFaqRequestDto {
  @ApiProperty({
    description:
      "FAQ question. Used for product marketing and student decision making. [常见问题-问题，用于产品营销与学生决策]",
    type: String,
    required: true,
    example: "What is included in this package?",
  })
  @IsString()
  @IsNotEmpty()
  question!: string;

  @ApiProperty({
    description:
      "FAQ answer. Provide clear and actionable guidance. [常见问题-答案，需清晰可执行]",
    type: String,
    required: true,
    example: "You will receive 4 sessions and 1 resume review.",
  })
  @IsString()
  @IsNotEmpty()
  answer!: string;
}

class ProductMetadataRequestDto {
  @ApiPropertyOptional({
    description:
      "Key product features shown in the catalog. [产品亮点，用于目录展示]",
    type: [String],
    isArray: true,
    required: false,
    example: ["1-on-1 mentoring", "Resume review"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({
    description:
      "Frequently asked questions displayed in the catalog. [目录展示的常见问题列表]",
    type: () => ProductFaqRequestDto,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductFaqRequestDto)
  faqs?: ProductFaqRequestDto[];

  @ApiPropertyOptional({
    description:
      "Deliverables the student will get after purchase. [购买后可获得的交付物]",
    type: [String],
    isArray: true,
    required: false,
    example: ["Resume PDF feedback", "Mock interview recording"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliverables?: string[];

  @ApiPropertyOptional({
    description:
      "Marketing-only duration text shown to users (not used for billing). [展示用时长文本，不参与计费]",
    type: String,
    required: false,
    example: "4 weeks",
  })
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional({
    description:
      "Prerequisites the student should prepare before using the product. [使用前置条件/准备事项]",
    type: [String],
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerequisites?: string[];
}

class CreateProductItemRequestDto {
  @ApiProperty({
    description:
      "Service type ID (UUID). Identifies the entitlement item. [服务类型ID(UUID)，标识权益项]",
    type: String,
    format: "uuid",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsUUID()
  serviceTypeId!: string;

  @ApiProperty({
    description:
      "Quantity of this service type included in the product. Must be >= 1. [该服务类型包含次数，必须>=1]",
    type: Number,
    required: true,
    example: 4,
    minimum: 1,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    description:
      "Sort order in product detail display. Default: 0 when omitted. [展示排序，未传时默认0]",
    type: Number,
    required: false,
    default: 0,
    example: 1,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateProductRequestDto {
  @ApiProperty({
    description: "Product name. [产品名称]",
    type: String,
    required: true,
    example: "Premium Mentoring Package",
  })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({
    description:
      "Product code (unique). Used for internal reference and contract snapshots. [产品编码(唯一)，用于内部引用与合同快照]",
    type: String,
    required: true,
    example: "PKG_PREMIUM_MENTORING_4",
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  code!: string;

  @ApiPropertyOptional({
    description: "Product description for marketing. [产品描述，用于营销展示]",
    type: String,
    required: false,
    example: "4 sessions with senior mentors + resume review.",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      "Cover image URL. [封面图URL]",
    type: String,
    required: false,
    example: "https://placehold.co/600x400",
  })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({
    description:
      "Target user personas. [目标用户画像]",
    isArray: true,
    enum: UserPersona,
    required: false,
    example: [UserPersona.UNDERGRADUATE],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(UserPersona, { each: true })
  targetUserPersonas?: UserPersona[];

  @ApiProperty({
    description:
      "Product price. Must be > 0. [产品价格，必须>0]",
    type: Number,
    required: true,
    example: 1999,
    minimum: 0.01,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  price!: number;

  @ApiPropertyOptional({
    description:
      "Currency (ISO 4217). Default is decided by domain/service when omitted. [币种(ISO 4217)，不传时由领域/服务默认]",
    enum: Currency,
    required: false,
    example: Currency.USD,
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({
    description:
      "Marketing labels shown on product cards. [产品卡片营销标签]",
    isArray: true,
    enum: MARKETING_LABEL_VALUES,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsIn(MARKETING_LABEL_VALUES, { each: true })
  marketingLabels?: MarketingLabel[];

  @ApiPropertyOptional({
    description:
      "Product metadata for display and guidance. [用于展示与指导的产品元数据]",
    type: () => ProductMetadataRequestDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductMetadataRequestDto)
  metadata?: ProductMetadataRequestDto;

  @ApiPropertyOptional({
    description:
      "Product entitlement items. If omitted, product contains no entitlements initially. [产品权益项列表，不传则初始无权益项]",
    type: () => CreateProductItemRequestDto,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductItemRequestDto)
  items?: CreateProductItemRequestDto[];
}

class AddProductItemRequestDto {
  @ApiProperty({
    description:
      "Service type ID (UUID) to add. [要添加的服务类型ID(UUID)]",
    type: String,
    format: "uuid",
    required: true,
  })
  @IsNotEmpty()
  @IsUUID()
  serviceTypeId!: string;

  @ApiProperty({
    description:
      "Quantity to add. Must be >= 1. [要添加的次数，必须>=1]",
    type: Number,
    required: true,
    minimum: 1,
    example: 2,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    description:
      "Optional sort order for the added item. [新增权益项的展示排序，可选]",
    type: Number,
    required: false,
    minimum: 0,
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

class ProductItemSortRequestDto {
  @ApiProperty({
    description:
      "Product item ID (UUID). [产品项ID(UUID)]",
    type: String,
    format: "uuid",
    required: true,
  })
  @IsNotEmpty()
  @IsUUID("4")
  itemId!: string;

  @ApiProperty({
    description:
      "New sort order. Must be >= 0. [新的排序值，必须>=0]",
    type: Number,
    required: true,
    minimum: 0,
    example: 0,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class UpdateProductRequestDto {
  @ApiPropertyOptional({
    description: "New product name. [新的产品名称]",
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: "New product description. [新的产品描述]",
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: "New cover image URL. [新的封面图URL]",
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({
    description: "Target user personas. [目标用户画像]",
    isArray: true,
    enum: UserPersona,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(UserPersona, { each: true })
  targetUserPersonas?: UserPersona[];

  @ApiPropertyOptional({
    description:
      "New price. Must be > 0. [新的价格，必须>0]",
    type: Number,
    required: false,
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number;

  @ApiPropertyOptional({
    description: "New currency. [新的币种]",
    enum: Currency,
    required: false,
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({
    description:
      "New marketing labels. [新的营销标签]",
    isArray: true,
    enum: MARKETING_LABEL_VALUES,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsIn(MARKETING_LABEL_VALUES, { each: true })
  marketingLabels?: MarketingLabel[];

  @ApiPropertyOptional({
    description:
      "Updated metadata. [更新后的元数据]",
    type: () => ProductMetadataRequestDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductMetadataRequestDto)
  metadata?: ProductMetadataRequestDto;

  @ApiPropertyOptional({
    description:
      "Add product items (entitlements). [新增产品项(权益项)]",
    type: () => AddProductItemRequestDto,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddProductItemRequestDto)
  addItems?: AddProductItemRequestDto[];

  @ApiPropertyOptional({
    description:
      "Remove product items by item IDs (UUID array). [按产品项ID(UUID数组)删除产品项]",
    type: [String],
    isArray: true,
    required: false,
    example: ["123e4567-e89b-12d3-a456-426614174000"],
  })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  removeItems?: string[];

  @ApiPropertyOptional({
    description:
      "Update sort order of existing items. [更新已存在产品项的排序]",
    type: () => ProductItemSortRequestDto,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductItemSortRequestDto)
  sortItems?: ProductItemSortRequestDto[];
}

export class UpdateProductStatusRequestDto {
  @ApiProperty({
    description:
      "Target product status. Controls product availability in catalog. [目标产品状态，控制目录可见性/可售性]",
    enum: ProductStatus,
    required: true,
    example: ProductStatus.ACTIVE,
  })
  @IsEnum(ProductStatus)
  status!: ProductStatus;
}

// Type aliases for backward compatibility
export type AddProductItemDto = AddProductItemRequestDto;
export type CreateProductDto = CreateProductRequestDto;
export type UpdateProductDto = UpdateProductRequestDto;

export class ProductFilterDto {
  @ApiPropertyOptional({
    description: "Whether to include deleted products. Default: false. [是否包含已删除产品，默认: false]",
    type: Boolean,
    required: false,
    default: false,
  })
  @IsOptional()
  includeDeleted?: boolean;

  @ApiPropertyOptional({
    description: "Product status filter. [产品状态筛选]",
    enum: ProductStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({
    description: "User persona filter. [用户画像筛选]",
    enum: UserPersona,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserPersona)
  userPersona?: UserPersona;

  @ApiPropertyOptional({
    description: "Marketing label filter. [营销标签筛选]",
    enum: MARKETING_LABEL_VALUES,
    required: false,
  })
  @IsOptional()
  @IsIn(MARKETING_LABEL_VALUES)
  marketingLabel?: MarketingLabel;

  @ApiPropertyOptional({
    description: "Product name filter (partial match). [产品名称筛选(部分匹配)]",
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: "Product code filter (partial match). [产品编码筛选(部分匹配)]",
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  code?: string;
}

