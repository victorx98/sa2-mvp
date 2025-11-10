import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsPositive,
  IsOptional,
} from "class-validator";

/**
 * Record Consumption DTO
 * Used when recording service consumption in ledger
 */
export class RecordConsumptionDto {
  @IsNotEmpty()
  @IsUUID()
  contractId: string;

  @IsNotEmpty()
  @IsString()
  studentId: string;

  @IsNotEmpty()
  @IsString()
  serviceType: string;

  @IsNotEmpty()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsUUID()
  relatedBookingId?: string;  // 关联预约ID（通用字段，适用于 session、class、mock_interview 等）

  @IsNotEmpty()
  @IsString()
  createdBy: string;
}
