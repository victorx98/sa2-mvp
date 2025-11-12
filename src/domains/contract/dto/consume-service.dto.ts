import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsPositive,
  IsOptional,
} from "class-validator";

/**
 * DTO for consuming service (v2.16.12 - 学生级权益累积制)
 * Used when recording service consumption (from session completion)
 *
 * @change {v2.16.12} Primary key changed from contractId to studentId
 */
export class ConsumeServiceDto {
  @IsNotEmpty()
  @IsString()
  studentId: string; // Student ID (学生ID) - NEW in v2.16.12

  @IsOptional()
  @IsUUID()
  contractId?: string; // Contract ID (optional for audit only) (合约ID - 仅用于审计，可选)

  @IsNotEmpty()
  @IsString()
  serviceType: string; // Service type (服务类型)

  @IsNotEmpty()
  @IsPositive()
  quantity: number; // Quantity to consume (消费数量)

  @IsOptional()
  @IsUUID()
  relatedBookingId?: string; // Associated booking ID (generic field for session, class, mock_interview, etc.) (关联预约ID)

  @IsOptional()
  @IsUUID()
  relatedHoldId?: string; // Associated hold ID (关联预留ID)

  @IsNotEmpty()
  @IsString()
  createdBy: string; // ID of creator (创建人ID)
}
