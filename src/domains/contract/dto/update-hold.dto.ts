import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsPositive,
  IsDate,
} from "class-validator";

/**
 * DTO for updating service hold
 * Follows "cancel-then-create" pattern (遵循"取消-然后-创建"模式)
 */
export class UpdateHoldDto {
  @IsNotEmpty()
  @IsString()
  holdId: string; // Hold ID to update (要更新的 hold ID)

  @IsOptional()
  @IsPositive()
  quantity?: number; // New quantity (新数量) - if not provided, uses original quantity (如果不提供，使用原数量)

  @IsOptional()
  @IsDate()
  expiryAt?: Date; // New expiration time (新过期时间) - if not provided, uses original time (如果不提供，使用原时间)

  @IsNotEmpty()
  @IsString()
  reason: string; // Reason for cancelling the original hold (取消原 hold 的原因)

  @IsNotEmpty()
  @IsString()
  updatedBy: string; // ID of the updater (更新者 ID)
}
