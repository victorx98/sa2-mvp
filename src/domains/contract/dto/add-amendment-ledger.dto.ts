import { ServiceType } from "@infrastructure/database/schema";
import { AmendmentLedgerType } from "@shared/types/contract-enums";
import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsEnum,
  IsPositive,
  IsOptional,
  IsIn,
} from "class-validator";

/**
 *
 * @change {v2.16.12} Primary key changed from contractId to studentId
 * @change {v2.16.12} Changed to insert into ledger table (trigger updates entitlement)
 * @change {v2.16.13} Renamed from entitlement to amendment ledger
 */
export class AddAmendmentLedgerDto {
  @IsNotEmpty()
  @IsString()
  studentId: string; // Student ID (学生ID) - NEW in v2.16.12

  @IsOptional()
  @IsUUID()
  contractId?: string; // Contract ID (optional for reference) (合约ID - 仅作参考，可选)

  @IsNotEmpty()
  @IsString()
  serviceType: ServiceType; // Service type (服务类型)

  @IsNotEmpty()
  @IsEnum(AmendmentLedgerType)
  ledgerType: AmendmentLedgerType; // Renamed from source (v2.16.12) - 从source重命名

  @IsNotEmpty()
  @IsPositive()
  quantityChanged: number; // Renamed from quantity (v2.16.12) - 从quantity重命名

  @IsNotEmpty()
  @IsString()
  reason: string; // Renamed from addOnReason (v2.16.12) - 从addOnReason重命名

  @IsOptional()
  description?: string; // Optional detailed description (可选详细说明)

  @IsOptional()
  attachments?: string[]; // Optional array of attachment URLs (可选附件URL数组)

  @IsOptional()
  @IsUUID()
  relatedBookingId?: string; // Associated booking ID (关联预约ID)

  @IsNotEmpty()
  @IsString()
  createdBy: string; // ID of creator (创建人ID)
}
