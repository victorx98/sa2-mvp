import { ApiProperty } from "@nestjs/swagger";

/**
 * Service Balance Response DTO
 * 服务余额响应 DTO
 */
export class ServiceBalanceResponseDto {
  @ApiProperty({ description: "Student ID" })
  studentId: string;

  @ApiProperty({ description: "Service type" })
  serviceType: string;

  @ApiProperty({ description: "Total quantity" })
  totalQuantity: number;

  @ApiProperty({ description: "Consumed quantity" })
  consumedQuantity: number;

  @ApiProperty({ description: "Held quantity" })
  heldQuantity: number;

  @ApiProperty({ description: "Available quantity" })
  availableQuantity: number;
}

