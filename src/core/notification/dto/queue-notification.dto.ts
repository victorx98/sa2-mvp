import { IsString, IsDate, IsEnum, IsObject, IsUUID } from "class-validator";

/**
 * Notification Type Enum
 */
export enum NotificationType {
  EMAIL = "email",
  FEISHU_BOT = "feishu_bot",
}

/**
 * Queue Notification DTO
 *
 * Parameters for queuing notification
 */
export class QueueNotificationDto {
  @IsUUID()
  sessionId: string; // 关联 session ID

  @IsEnum(NotificationType)
  type: NotificationType; // 通知类型

  @IsString()
  recipient: string; // 接收者（邮箱或飞书 user_id）

  @IsString()
  template: string; // 模板名称

  @IsObject()
  data: Record<string, unknown>; // 模板数据

  @IsDate()
  scheduledTime: Date; // 计划发送时间
}
