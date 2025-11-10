import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsEnum,
  IsPositive,
  IsOptional,
} from "class-validator";

/**
 * Add Entitlement DTO
 * Used when adding additional service entitlements to a contract
 */
export class AddEntitlementDto {
  @IsNotEmpty()
  @IsUUID()
  contractId: string;

  @IsNotEmpty()
  @IsString()
  serviceType: string;

  @IsNotEmpty()
  @IsEnum(["addon", "promotion", "compensation"])
  source: "addon" | "promotion" | "compensation";

  @IsNotEmpty()
  @IsPositive()
  quantity: number;

  @IsNotEmpty()
  @IsString()
  addOnReason: string;

  @IsOptional()
  @IsUUID()
  relatedBookingId?: string;  // 关联预约ID（如果权益添加与某次预约相关）

  @IsNotEmpty()
  @IsString()
  createdBy: string;
}
