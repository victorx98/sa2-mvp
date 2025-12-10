import { IsEnum, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { ContractStatus } from "@shared/types/contract-enums";

/**
 * Update Contract Status DTO [更新合同状态DTO]
 * Used for updating contract status through unified endpoint
 * [用于通过统一端点更新合同状态]
 *
 * Note: Status change timestamps are automatically recorded in contract_status_history table
 * [注意：状态变更时间戳会自动记录在contract_status_history表中]
 */
export class UpdateContractStatusDto {
  @ApiProperty({
    enum: ContractStatus,
    description: "Target status for the contract [合同的目标状态]",
    example: ContractStatus.ACTIVE,
  })
  @IsEnum(ContractStatus)
  status: ContractStatus; // Target status [目标状态]

  @ApiProperty({
    required: false,
    description:
      "Reason for status change (required for suspend and terminate) [状态变更原因（暂停和终止时需要）]",
    example: "Payment issue",
  })
  @IsOptional()
  @IsString()
  reason?: string; // Used for suspend and terminate operations [用于暂停和终止操作]

  @ApiProperty({
    required: false,
    description:
      "User ID who signed the contract (optional, will use current user if not provided) [签署合同的用户ID（可选，未提供时使用当前用户）]",
  })
  @IsOptional()
  @IsString()
  signedBy?: string; // Used for sign operation (from user context) [用于签署操作（从用户上下文获取）]
}
