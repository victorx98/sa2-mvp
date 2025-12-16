import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ContractStatus, AmendmentLedgerType } from "@shared/types/contract-enums";
import { Currency } from "@shared/types/catalog-enums";

class ContractProductSnapshotItemResponseDto {
  @ApiProperty({
    description: "Product item ID (UUID). [产品项ID(UUID)]",
    type: String,
    format: "uuid",
  })
  productItemId!: string;

  @ApiProperty({
    description: "Service type code. [服务类型编码]",
    type: String,
    example: "resume_review",
  })
  serviceTypeCode!: string;

  @ApiProperty({
    description: "Quantity in snapshot item. [快照项包含次数]",
    type: Number,
    example: 4,
  })
  quantity!: number;

  @ApiProperty({
    description: "Sort order. [排序]",
    type: Number,
    example: 0,
  })
  sortOrder!: number;
}

class ContractProductSnapshotResponseDto {
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
    description: "Price at purchase time (decimal string). [购买时价格(字符串)]",
    type: String,
    example: "1999.00",
  })
  price!: string;

  @ApiProperty({
    description: "Currency at purchase time. [购买时币种]",
    type: String,
    example: "USD",
  })
  currency!: string;

  @ApiPropertyOptional({
    description: "Validity period in days. [有效期天数]",
    type: Number,
    example: 365,
  })
  validityDays?: number;

  @ApiProperty({
    description: "Snapshot items. [快照权益项]",
    type: () => ContractProductSnapshotItemResponseDto,
    isArray: true,
  })
  items!: ContractProductSnapshotItemResponseDto[];

  @ApiProperty({
    description: "Snapshot time (ISO 8601). [快照时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  snapshotAt!: string;
}

export class ContractResponseDto {
  @ApiProperty({
    description: "Contract ID (UUID). [合同ID(UUID)]",
    type: String,
    format: "uuid",
  })
  id!: string;

  @ApiProperty({
    description:
      "Contract number (unique). Human-friendly identifier. [合同编号(唯一)，可读标识]",
    type: String,
    example: "CONTRACT-2025-01-00001",
  })
  contractNumber!: string;

  @ApiPropertyOptional({
    description: "Contract title. [合同标题]",
    type: String,
    example: "Premium Mentoring Contract",
  })
  title?: string | null;

  @ApiProperty({
    description: "Student ID (UUID). [学生ID(UUID)]",
    type: String,
    format: "uuid",
  })
  studentId!: string;

  @ApiProperty({
    description:
      "Product ID (UUID). ACL: no foreign key to product table. [产品ID(UUID)，防腐层：不与目录表外键关联]",
    type: String,
    format: "uuid",
  })
  productId!: string;

  @ApiProperty({
    description: "Frozen product snapshot. [产品快照(冻结)]",
    type: () => ContractProductSnapshotResponseDto,
  })
  productSnapshot!: ContractProductSnapshotResponseDto;

  @ApiProperty({
    description: "Contract status. [合同状态]",
    enum: ContractStatus,
    example: ContractStatus.DRAFT,
  })
  status!: ContractStatus;

  @ApiProperty({
    description:
      "Total amount stored as decimal string. [合同总金额(字符串)]",
    type: String,
    example: "1999.00",
  })
  totalAmount!: string;

  @ApiProperty({
    description: "Contract currency. [合同币种]",
    enum: Currency,
    example: Currency.USD,
  })
  currency!: Currency;

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

export class ConsumeServiceResponseDto {
  @ApiProperty({
    description:
      "Whether the consume operation succeeded. [消费操作是否成功]",
    type: Boolean,
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description:
      "Human-readable message. [可读消息]",
    type: String,
    example: "Service consumed successfully",
  })
  message!: string;
}

export class ContractServiceEntitlementResponseDto {
  @ApiProperty({
    description: "Entitlement record ID (UUID). [权益记录ID(UUID)]",
    type: String,
    format: "uuid",
  })
  id!: string;

  @ApiProperty({
    description: "Student ID (UUID). [学生ID(UUID)]",
    type: String,
    format: "uuid",
  })
  studentId!: string;

  @ApiProperty({
    description: "Service type code. [服务类型编码]",
    type: String,
    example: "resume_review",
  })
  serviceType!: string;

  @ApiProperty({
    description: "Total quantity. [总权益次数]",
    type: Number,
    example: 10,
  })
  totalQuantity!: number;

  @ApiProperty({
    description: "Consumed quantity. [已消费次数]",
    type: Number,
    example: 2,
  })
  consumedQuantity!: number;

  @ApiProperty({
    description: "Held quantity. [预占次数]",
    type: Number,
    example: 1,
  })
  heldQuantity!: number;

  @ApiProperty({
    description: "Available quantity. [可用次数]",
    type: Number,
    example: 7,
  })
  availableQuantity!: number;

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

  @ApiPropertyOptional({
    description: "Created by user ID (UUID). [创建人用户ID(UUID)]",
    type: String,
    format: "uuid",
  })
  createdBy?: string | null;
}

class StudentContractProductSummaryResponseDto {
  @ApiProperty({ description: "Product ID (UUID). [产品ID(UUID)]", type: String })
  id!: string;

  @ApiProperty({ description: "Product name. [产品名称]", type: String })
  name!: string;
}

export class StudentContractResponseDto {
  @ApiProperty({ description: "Contract ID (UUID). [合同ID(UUID)]", type: String })
  id!: string;

  @ApiProperty({
    description: "Contract number. [合同编号]",
    type: String,
    example: "CONTRACT-2025-01-00001",
  })
  contract_number!: string;

  @ApiProperty({
    description: "Product summary in contract snapshot. [合同快照中的产品摘要]",
    type: () => StudentContractProductSummaryResponseDto,
  })
  product!: StudentContractProductSummaryResponseDto;

  @ApiProperty({
    description: "Contract status. [合同状态]",
    enum: ContractStatus,
  })
  status!: ContractStatus;
}

export class UpdateContractStatusAuditResponseDto {
  @ApiProperty({
    description:
      "Target status applied. [已应用的目标状态]",
    enum: ContractStatus,
  })
  status!: ContractStatus;

  @ApiPropertyOptional({
    description: "Optional reason. [原因(可选)]",
    type: String,
  })
  reason?: string;

  @ApiPropertyOptional({
    description: "Signer user ID (UUID). [签署人用户ID(UUID)]",
    type: String,
    format: "uuid",
  })
  signedBy?: string;
}

export class AddAmendmentLedgerRequestEchoDto {
  @ApiProperty({
    description: "Ledger type. [台账类型]",
    enum: AmendmentLedgerType,
  })
  ledgerType!: AmendmentLedgerType;
}

