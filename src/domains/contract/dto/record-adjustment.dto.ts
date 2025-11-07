import { IsNotEmpty, IsUUID, IsString, IsInt } from "class-validator";

/**
 * Record Adjustment DTO
 * Used when recording balance adjustments in ledger
 */
export class RecordAdjustmentDto {
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
  @IsInt()
  quantity: number; // Can be positive or negative

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsNotEmpty()
  @IsString()
  createdBy: string;
}
