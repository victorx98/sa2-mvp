import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsObject,
  ValidateNested,
  IsOptional,
  IsDateString,
} from "class-validator";
import { Type } from "class-transformer";
import { IProductSnapshot } from "../common/types/snapshot.types";

/**
 * DTO for creating contract (创建合约的DTO)
 * Used when creating a new contract from a product (用于从产品创建新合约)
 */
export class CreateContractDto {
  @IsNotEmpty()
  @IsString()
  studentId: string; // Student ID (学生ID)

  @IsNotEmpty()
  @IsUUID()
  productId: string; // Product ID (产品ID)

  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  productSnapshot: IProductSnapshot; // Product snapshot (产品快照)

  @IsOptional()
  @IsDateString()
  signedAt?: Date; // Contract signing date (合约签署日期)

  @IsOptional()
  @IsString()
  overrideAmount?: string; // Price override amount (价格覆盖金额)

  @IsOptional()
  @IsString()
  overrideReason?: string; // Reason for price override (价格覆盖原因)

  @IsOptional()
  @IsString()
  overrideApprovedBy?: string; // Approver of price override (价格覆盖批准人)

  @IsNotEmpty()
  @IsString()
  createdBy: string; // ID of creator (创建人ID)

  @IsOptional()
  @IsString()
  title?: string; // Contract title (合约标题)
}
