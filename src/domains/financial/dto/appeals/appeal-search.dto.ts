/**
 * Appeal Search DTO (申诉搜索DTO)
 *
 * This DTO defines the filter criteria for searching mentor appeals
 * (该DTO定义搜索导师申诉的筛选条件)
 */

import { IsString, IsOptional, IsUUID, IsDateString } from "class-validator";

export class AppealSearchDto {
  @IsUUID()
  @IsOptional()
  mentorId?: string; // Filter by mentor ID (按导师筛选)

  @IsUUID()
  @IsOptional()
  counselorId?: string; // Filter by assigned counselor ID (按处理顾问筛选)

  @IsString()
  @IsOptional()
  status?: string; // Filter by status: PENDING, APPROVED, REJECTED (按状态筛选)

  @IsDateString()
  @IsOptional()
  startDate?: Date; // Filter appeals created on or after this date (筛选在此日期及之后创建的申诉)

  @IsDateString()
  @IsOptional()
  endDate?: Date; // Filter appeals created on or before this date (筛选在此日期及之前创建的申诉)

  @IsString()
  @IsOptional()
  appealType?: string; // Filter by appeal type (按申诉类型筛选)

  @IsString()
  @IsOptional()
  minAmount?: string; // Minimum appeal amount filter as string (最小申诉金额)

  @IsString()
  @IsOptional()
  maxAmount?: string; // Maximum appeal amount filter as string (最大申诉金额)
}
