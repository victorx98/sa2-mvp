import { IsOptional, IsUUID, IsString } from "class-validator";

/**
 * Service Balance Query DTO
 * Used for querying service balance
 */
export class ServiceBalanceQueryDto {
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  serviceType?: string;
}
