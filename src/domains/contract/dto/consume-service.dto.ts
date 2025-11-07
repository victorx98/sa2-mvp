import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsPositive,
  IsOptional,
} from "class-validator";

/**
 * Consume Service DTO
 * Used when recording service consumption (from session completion)
 */
export class ConsumeServiceDto {
  @IsNotEmpty()
  @IsUUID()
  contractId: string;

  @IsNotEmpty()
  @IsString()
  serviceType: string;

  @IsNotEmpty()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsUUID()
  holdId?: string;

  @IsNotEmpty()
  @IsString()
  createdBy: string;
}
