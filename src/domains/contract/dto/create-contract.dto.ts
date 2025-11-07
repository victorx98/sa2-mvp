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
 * Create Contract DTO
 * Used when creating a new contract from a product
 */
export class CreateContractDto {
  @IsNotEmpty()
  @IsString()
  studentId: string;

  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  productSnapshot: IProductSnapshot;

  @IsOptional()
  @IsDateString()
  signedAt?: Date;

  @IsOptional()
  @IsString()
  overrideAmount?: string;

  @IsOptional()
  @IsString()
  overrideReason?: string;

  @IsOptional()
  @IsString()
  overrideApprovedBy?: string;

  @IsNotEmpty()
  @IsString()
  createdBy: string;
}
