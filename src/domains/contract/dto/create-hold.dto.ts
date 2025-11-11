import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsPositive,
  IsOptional,
} from "class-validator";

/**
 * DTO for creating service hold (创建服务预留的DTO)
 * Used when creating a service reservation (用于创建服务预留)
 *
 * v2.16.11: Removed relatedBookingId parameter - always set to null on creation, updated via event (v2.16.11: 移除relatedBookingId参数 - 创建时始终设为null，通过事件更新)
 * v2.16.12: Removed expiryHours - use expiryAt instead (v2.16.12: 移除expiryHours - 请使用expiryAt替代)
 */
export class CreateHoldDto {
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
  quantity: number; // Quantity to hold (预留数量)

  @IsNotEmpty()
  @IsString()
  createdBy: string; // ID of creator (创建人ID)

  /**
   * Expiry time for the hold (预留的过期时间)
   * - null or undefined: no expiry (永不过期)
   * - Timestamp: the specific time when the hold expires (具体过期时间戳)
   * - Examples: new Date(Date.now() + 2 * 60 * 60 * 1000) (2 hours from now) (示例: new Date(Date.now() + 2 * 60 * 60 * 1000) (2小时后))
   */
  @IsOptional()
  expiryAt?: Date | null;
}
