/**
 * Approve Appeal DTO (批准申诉DTO)
 *
 * This DTO defines the data structure for approving a mentor appeal
 * (该DTO定义批准导师申诉的数据结构)
 */

import { IsNumber, IsString, IsOptional, MaxLength, Matches } from "class-validator";

export class ApproveAppealDto {
  @IsNumber()
  @IsOptional()
  appealAmount?: number; // New appeal amount if original is invalid (如果原始金额无效，提供新的申诉金额)

  @IsString()
  @IsOptional()
  @Matches(/^[A-Z]{3}$/, { message: "currency must be a valid ISO 4217 3-letter code" })
  currency?: string; // New currency if original is invalid (如果原始金额无效，提供新的货币类型)

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  comments?: string; // Additional comments about the approval (关于批准的额外评论)
}
