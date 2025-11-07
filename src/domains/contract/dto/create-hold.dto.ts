import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsPositive,
  IsOptional,
} from "class-validator";

/**
 * Create Hold DTO
 * Used when creating a service hold (reservation)
 */
export class CreateHoldDto {
  @IsNotEmpty()
  @IsUUID()
  contractId: string;

  @IsNotEmpty()
  @IsString()
  studentId: string;

  @IsNotEmpty()
  @IsString()
  serviceType: string;

  @IsNotEmpty()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsUUID()
  relatedBookingId?: string;

  @IsNotEmpty()
  @IsString()
  createdBy: string;
}
