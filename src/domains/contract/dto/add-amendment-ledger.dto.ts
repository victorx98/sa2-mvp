import { ServiceType } from "@infrastructure/database/schema";
import { AmendmentLedgerType } from "@shared/types/contract-enums";
import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsEnum,
  IsPositive,
  IsOptional,
  ValidateIf,
} from "class-validator";

/**
 * DTO for adding amendment ledger
 * Used when adding additional entitlements (addon, promotion, compensation)
 */
export class AddAmendmentLedgerDto {
  @IsNotEmpty()
  @IsString()
  studentId: string; // Student ID (学生ID)

  @IsOptional()
  @IsUUID()
  contractId?: string; // Contract ID (optional for reference) (合约ID - 仅作参考，可选)

  @IsNotEmpty()
  @IsString()
  serviceType: ServiceType; // Service type (服务类型)

  @IsNotEmpty()
  @IsEnum(AmendmentLedgerType)
  ledgerType: AmendmentLedgerType; // Ledger type (账本类型)

  @IsNotEmpty()
  @IsPositive()
  quantityChanged: number; // Quantity changed (变更数量)

  @IsNotEmpty()
  @IsString()
  reason: string; // Reason for amendment (调整原因)

  @IsOptional()
  description?: string; // Optional detailed description (可选详细说明)

  @IsOptional()
  attachments?: string[]; // Optional array of attachment URLs (可选附件URL数组)

  @IsOptional()
  @IsUUID()
  relatedBookingId?: string; // Associated booking ID (关联预约ID)

  @ValidateIf(
    (o) => o.relatedBookingId !== undefined && o.relatedBookingId !== null,
  )
  @IsNotEmpty({
    message: "bookingSource is required when relatedBookingId is provided",
  })
  @IsString()
  bookingSource?: string; // Booking table name (e.g., 'regular_mentoring_sessions', 'job_applications') - required when relatedBookingId is provided [预约表名（如'regular_mentoring_sessions'、'job_applications'）- 当relatedBookingId存在时必填]

  @IsNotEmpty()
  @IsString()
  createdBy: string; // ID of creator (创建人ID)
}
