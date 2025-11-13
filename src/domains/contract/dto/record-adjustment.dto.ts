import { IsNotEmpty, IsUUID, IsString, IsInt } from "class-validator";

/**
 * DTO for recording adjustment (记录调整的DTO)
 * Used when recording balance adjustments in ledger (用于在台账中记录余额调整)
 */
export class RecordAdjustmentDto {
  @IsNotEmpty()
  @IsUUID()
  contractId: string; // Contract ID (合约ID)

  @IsNotEmpty()
  @IsString()
  studentId: string; // Student ID (学生ID)

  @IsNotEmpty()
  @IsString()
  serviceType: string; // Service type (服务类型)

  @IsNotEmpty()
  @IsInt()
  quantity: number; // Quantity adjustment (can be positive or negative) (数量调整(可以为正或负))

  @IsNotEmpty()
  @IsString()
  reason: string; // Reason for adjustment (调整原因)

  @IsNotEmpty()
  @IsString()
  createdBy: string; // ID of creator (创建人ID)
}
