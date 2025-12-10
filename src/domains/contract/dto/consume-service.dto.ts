import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsPositive,
  IsOptional,
  ValidateIf,
} from "class-validator";

/**
 * DTO for consuming service
 * Used when recording service consumption (from session completion)
 */
export class ConsumeServiceDto {
  @IsNotEmpty()
  @IsString()
  studentId: string; // Student ID (学生ID)

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

  @ValidateIf(
    (o) => o.relatedBookingId !== undefined && o.relatedBookingId !== null,
  )
  @IsNotEmpty({
    message: "bookingSource is required when relatedBookingId is provided",
  })
  @IsString()
  bookingSource?: string; // Booking table name (e.g., 'regular_mentoring_sessions', 'job_applications') [预约表名（如'regular_mentoring_sessions'、'job_applications'）]

  @IsOptional()
  @IsString()
  createdBy?: string; // ID of creator (will be set from user context, not from request body) [创建人ID（将从用户上下文获取，不从请求体获取）]
}
