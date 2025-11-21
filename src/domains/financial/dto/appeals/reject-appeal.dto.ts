/**
 * Reject Appeal DTO (驳回申诉DTO)
 *
 * This DTO defines the data structure for rejecting a mentor appeal
 * (该DTO定义驳回导师申诉的数据结构)
 */

import { IsString, IsNotEmpty, MaxLength } from "class-validator";

export class RejectAppealDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  rejectionReason: string; // Reason for rejecting the appeal (驳回申诉的理由)
}
