import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsPositive,
  IsOptional,
} from "class-validator";

/**
 * Record Consumption DTO
 * Used when recording service consumption in ledger
 */
export class RecordConsumptionDto {
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
  sessionId?: string;

  @IsNotEmpty()
  @IsString()
  createdBy: string;
}
