import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsEnum,
  IsPositive,
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

  @IsNotEmpty()
  @IsString()
  createdBy: string;
}
