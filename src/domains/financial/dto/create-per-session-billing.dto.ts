/**
 * Create Per Session Billing DTO[创建按会话计费DTO]
 *
 * This DTO defines the data structure for creating per-session billing records[此DTO定义了创建按会话计费记录的数据结构]
 */

import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDate,
  IsOptional,
  IsUUID,
} from "class-validator";

export class CreatePerSessionBillingDto {
  @IsUUID()
  @IsNotEmpty()
  sessionId: string; // Session ID[会话ID]

  @IsUUID()
  @IsNotEmpty()
  contractId: string; // Contract ID[合同ID]

  @IsUUID()
  @IsNotEmpty()
  mentorUserId: string; // Mentor user ID[导师用户ID]

  @IsUUID()
  @IsNotEmpty()
  studentUserId: string; // Student user ID[学生用户ID]

  @IsString()
  @IsNotEmpty()
  serviceTypeCode: string; // Service type code (references service_types.code field)[服务类型代码（引用service_types.code字段）]

  @IsString()
  @IsOptional()
  serviceName?: string; // Service name[服务名称]

  @IsNumber()
  @IsNotEmpty()
  durationHours: number; // Duration in hours[持续时间（小时）]

  @IsDate()
  @IsNotEmpty()
  startTime: Date; // Session start time[会话开始时间]

  @IsDate()
  @IsNotEmpty()
  endTime: Date; // Session end time[会话结束时间]

  @IsOptional()
  metadata?: Record<string, unknown>; // Additional metadata[额外元数据]
}
