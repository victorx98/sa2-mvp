/**
 * 金融领域事件类型定义
 *
 * 定义金融领域所有标准化事件类型和数据结构
 * 严格按照 mentor_payable_service_interface.md 文档要求定义
 */

import {
  IsString,
  IsNumber,
  IsDate,
  IsBoolean,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  Min,
  Max,
} from "class-validator";

/**
 * 金融事件接口 - 所有金融事件必须实现的接口
 * Financial Event Interface - All financial events must implement this interface
 */
export interface IFinancialEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventTimestamp: Date;
  readonly eventVersion: string;
}

/**
 * 会话完成事件 - 严格按照文档定义
 * Session Completed Event - Strictly following document specification
 */
export class SessionCompletedEvent implements IFinancialEvent {
  @IsUUID()
  @IsNotEmpty()
  readonly eventId!: string;

  @IsString()
  @IsNotEmpty()
  readonly eventType!: string;

  @IsDate()
  @IsNotEmpty()
  readonly eventTimestamp!: Date;

  @IsString()
  @IsNotEmpty()
  readonly eventVersion!: string;

  @IsUUID()
  @IsNotEmpty()
  readonly sessionId!: string;

  @IsUUID()
  @IsNotEmpty()
  readonly mentorUserId!: string;

  @IsUUID()
  @IsOptional()
  readonly studentUserId?: string;

  @IsString()
  @IsNotEmpty()
  readonly mentorName!: string;

  @IsString()
  @IsNotEmpty()
  readonly studentName!: string;

  @IsString()
  @IsNotEmpty()
  readonly serviceTypeCode!: string;

  @IsString()
  @IsNotEmpty()
  readonly serviceName!: string;

  @IsNumber()
  @IsOptional()
  readonly durationHours?: number;

  @IsDate()
  @IsNotEmpty()
  readonly completedAt!: Date;

  @IsBoolean()
  @IsNotEmpty()
  readonly requiredEvaluation!: boolean;

  @IsUUID()
  @IsOptional()
  readonly servicePackageId?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  readonly packageTotalSessions?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  readonly packageCompletedSessions?: number;

  constructor(props: Partial<SessionCompletedEvent>) {
    Object.assign(this, props);
  }
}

/**
 * 会话评价完成事件 - 严格按照文档定义
 * Session Evaluated Event - Strictly following document specification
 */
export class SessionEvaluatedEvent implements IFinancialEvent {
  @IsUUID()
  @IsNotEmpty()
  readonly eventId!: string;

  @IsString()
  @IsNotEmpty()
  readonly eventType!: string;

  @IsDate()
  @IsNotEmpty()
  readonly eventTimestamp!: Date;

  @IsString()
  @IsNotEmpty()
  readonly eventVersion!: string;

  @IsUUID()
  @IsNotEmpty()
  readonly sessionId!: string;

  @IsUUID()
  @IsNotEmpty()
  readonly mentorUserId!: string;

  @IsUUID()
  @IsNotEmpty()
  readonly studentUserId!: string;

  @IsString()
  @IsNotEmpty()
  readonly mentorName!: string;

  @IsString()
  @IsNotEmpty()
  readonly studentName!: string;

  @IsString()
  @IsNotEmpty()
  readonly serviceTypeCode!: string;

  @IsString()
  @IsNotEmpty()
  readonly serviceName!: string;

  @IsNumber()
  @IsOptional()
  readonly durationHours?: number;

  @IsDate()
  @IsNotEmpty()
  readonly reviewedAt!: Date;

  @IsUUID()
  @IsNotEmpty()
  readonly contractId!: string;

  @IsDate()
  @IsNotEmpty()
  readonly startTime!: Date;

  @IsDate()
  @IsNotEmpty()
  readonly endTime!: Date;

  @IsNumber()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  readonly rating!: number;

  @IsString()
  @IsOptional()
  readonly ratingComment?: string;

  @IsUUID()
  @IsOptional()
  readonly servicePackageId?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  readonly packageTotalSessions?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  readonly packageCompletedSessions?: number;

  constructor(props: Partial<SessionEvaluatedEvent>) {
    Object.assign(this, props);
  }
}
