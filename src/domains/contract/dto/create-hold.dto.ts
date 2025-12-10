import {
  IsNotEmpty,
  IsString,
  IsPositive,
  IsOptional,
  IsDate,
} from "class-validator";

/**
 * DTO for creating service hold
 * Used when creating a service reservation (用于创建服务预留)
 */
export class CreateHoldDto {
  @IsNotEmpty()
  @IsString()
  studentId: string; // Student ID (学生ID)

  @IsNotEmpty()
  @IsString()
  serviceType: string; // Service type (服务类型)

  @IsNotEmpty()
  @IsPositive()
  quantity: number; // Quantity to hold (预留数量)

  @IsOptional()
  @IsDate()
  expiryAt?: Date; // Expiration time (过期时间) - null表示永不过期 [null means never expires]

  @IsNotEmpty()
  @IsString()
  createdBy: string; // ID of creator (创建人ID)
}
