import { ApiProperty, ApiPropertyOptional, getSchemaPath } from "@nestjs/swagger";
import { SettlementMethod, SettlementStatus } from "@domains/financial/dto/settlement";
import {
  ChannelBatchPayPaymentDetailsDto,
  CheckPaymentDetailsDto,
  DomesticTransferPaymentDetailsDto,
  GustoInternationalPaymentDetailsDto,
  GustoPaymentDetailsDto,
} from "@api/dto/request/financial/payment-details.dto";

export class SettlementDetailResponseDto {
  @ApiProperty({ description: "Settlement ID (UUID). [结算ID(UUID)]", type: String })
  id!: string;

  @ApiProperty({ description: "Mentor ID (UUID). [导师ID(UUID)]", type: String })
  mentorId!: string;

  @ApiProperty({
    description: "Settlement month (YYYY-MM). [结算月份(YYYY-MM)]",
    type: String,
    example: "2025-11",
  })
  settlementMonth!: string;

  @ApiProperty({
    description: "Original amount (decimal string). [原始金额(字符串)]",
    type: String,
    example: "1000.00",
  })
  originalAmount!: string;

  @ApiProperty({
    description: "Target amount (decimal string). [目标金额(字符串)]",
    type: String,
    example: "950.00",
  })
  targetAmount!: string;

  @ApiProperty({ description: "Original currency. [原始币种]", type: String, example: "USD" })
  originalCurrency!: string;

  @ApiProperty({ description: "Target currency. [目标币种]", type: String, example: "CNY" })
  targetCurrency!: string;

  @ApiProperty({
    description: "Exchange rate (decimal string). [汇率(字符串)]",
    type: String,
    example: "7.2",
  })
  exchangeRate!: string;

  @ApiProperty({
    description: "Deduction rate (decimal string). [扣除比率(字符串)]",
    type: String,
    example: "0.0500",
  })
  deductionRate!: string;

  @ApiProperty({
    description: "Settlement status (always CONFIRMED). [结算状态(始终CONFIRMED)]",
    enum: SettlementStatus,
    example: SettlementStatus.CONFIRMED,
  })
  status!: SettlementStatus;

  @ApiProperty({
    description: "Settlement method. [结算方式]",
    enum: SettlementMethod,
    example: SettlementMethod.DOMESTIC_TRANSFER,
  })
  settlementMethod!: SettlementMethod;

  @ApiProperty({
    description: "Created time (ISO 8601). [创建时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  createdAt!: string;

  @ApiProperty({
    description: "Created by user ID (UUID). [创建人用户ID(UUID)]",
    type: String,
    format: "uuid",
  })
  createdBy!: string;
}

export class MentorPaymentInfoResponseDto {
  @ApiProperty({ description: "Payment info ID (UUID). [支付信息ID(UUID)]", type: String })
  id!: string;

  @ApiProperty({ description: "Mentor ID (UUID). [导师ID(UUID)]", type: String })
  mentorId!: string;

  @ApiProperty({ description: "Payment currency (ISO 4217). [支付币种]", type: String })
  paymentCurrency!: string;

  @ApiProperty({
    description: "Payment method. [支付方式]",
    enum: SettlementMethod,
  })
  paymentMethod!: SettlementMethod;

  @ApiProperty({
    description:
      "Payment details object (polymorphic). [支付详情对象(多态)]",
    oneOf: [
      { $ref: getSchemaPath(DomesticTransferPaymentDetailsDto) },
      { $ref: getSchemaPath(GustoPaymentDetailsDto) },
      { $ref: getSchemaPath(GustoInternationalPaymentDetailsDto) },
      { $ref: getSchemaPath(CheckPaymentDetailsDto) },
      { $ref: getSchemaPath(ChannelBatchPayPaymentDetailsDto) },
    ],
  })
  paymentDetails!:
    | DomesticTransferPaymentDetailsDto
    | GustoPaymentDetailsDto
    | GustoInternationalPaymentDetailsDto
    | CheckPaymentDetailsDto
    | ChannelBatchPayPaymentDetailsDto;

  @ApiProperty({
    description: "Status (ACTIVE/INACTIVE). [状态：ACTIVE/INACTIVE]",
    type: String,
    example: "ACTIVE",
  })
  status!: string;

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
    description: "Updated by user ID (UUID). [更新人用户ID(UUID)]",
    type: String,
    format: "uuid",
  })
  updatedBy?: string;
}

