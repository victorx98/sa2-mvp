import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsPositive,
  IsOptional,
} from "class-validator";

/**
 * DTO for consuming service (消费服务的DTO)
 * Used when recording service consumption (from session completion) (用于记录服务消费(来自会话完成))
 */
export class ConsumeServiceDto {
  @IsNotEmpty()
  @IsUUID()
  contractId: string; // Contract ID (合约ID)

  @IsNotEmpty()
  @IsString()
  serviceType: string; // Service type (服务类型)

  @IsNotEmpty()
  @IsPositive()
  quantity: number; // Quantity to consume (消费数量)

  @IsOptional()
  @IsUUID()
  relatedBookingId?: string; // Associated booking ID (generic field for session, class, mock_interview, etc.) (关联预约ID(通用字段，适用于session、class、mock_interview等))

  @IsOptional()
  @IsUUID()
  relatedHoldId?: string; // Associated hold ID (关联预留ID)

  @IsNotEmpty()
  @IsString()
  createdBy: string; // ID of creator (创建人ID)
}
