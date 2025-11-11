import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsEnum,
  IsPositive,
  IsOptional,
} from "class-validator";

/**
 * DTO for adding service entitlement (添加服务权益的DTO)
 * Used when adding additional service entitlements to a contract (用于向合约添加额外的服务权益)
 */
export class AddEntitlementDto {
  @IsNotEmpty()
  @IsUUID()
  contractId: string; // Contract ID (合约ID)

  @IsNotEmpty()
  @IsString()
  serviceType: string; // Service type (服务类型)

  @IsNotEmpty()
  @IsEnum(["addon", "promotion", "compensation"])
  source: "addon" | "promotion" | "compensation"; // Source type (来源类型)

  @IsNotEmpty()
  @IsPositive()
  quantity: number; // Quantity of service entitlement (服务权益数量)

  @IsNotEmpty()
  @IsString()
  addOnReason: string; // Reason for adding entitlement (添加权益的原因)

  @IsOptional()
  @IsUUID()
  relatedBookingId?: string; // Associated booking ID (if entitlement relates to a booking) (关联预约ID(如果权益与预约相关))

  @IsNotEmpty()
  @IsString()
  createdBy: string; // ID of creator (创建人ID)
}
