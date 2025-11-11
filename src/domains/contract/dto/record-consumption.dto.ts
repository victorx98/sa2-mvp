import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsPositive,
  IsOptional,
} from "class-validator";

/**
 * DTO for recording consumption (记录消费的DTO)
 * Used when recording service consumption in ledger (用于在台账中记录服务消费)
 */
export class RecordConsumptionDto {
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
  @IsPositive()
  quantity: number; // Quantity to consume (消费数量)

  @IsOptional()
  @IsUUID()
  relatedBookingId?: string; // Associated booking ID (generic field for session, class, mock_interview, etc.) (关联预约ID(通用字段，适用于session、class、mock_interview等))

  @IsNotEmpty()
  @IsString()
  createdBy: string; // ID of creator (创建人ID)
}
