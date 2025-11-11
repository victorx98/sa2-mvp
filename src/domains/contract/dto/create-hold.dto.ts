import {
  IsNotEmpty,
  IsString,
  IsPositive,
} from "class-validator";

/**
 * DTO for creating service hold (v2.16.12 - 学生级权益累积制)
 * Used when creating a service reservation (用于创建服务预留)
 *
 * v2.16.11: Removed relatedBookingId parameter - always set to null on creation, updated via event
 * v2.16.12: Removed contractId (now student-level) and expiryAt (holds no longer expire - manual release only)
 *
 * @change {v2.16.12} Removed contractId - now operates at student level across all contracts
 * @change {v2.16.12} Removed expiryAt - holds no longer expire automatically, only manual release
 */
export class CreateHoldDto {
  @IsNotEmpty()
  @IsString()
  studentId: string; // Student ID (学生ID) - Primary key in v2.16.12

  @IsNotEmpty()
  @IsString()
  serviceType: string; // Service type (服务类型)

  @IsNotEmpty()
  @IsPositive()
  quantity: number; // Quantity to hold (预留数量)

  @IsNotEmpty()
  @IsString()
  createdBy: string; // ID of creator (创建人ID)
}
