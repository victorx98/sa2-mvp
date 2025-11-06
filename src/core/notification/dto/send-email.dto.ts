import { IsString, IsOptional, IsArray, IsObject } from "class-validator";

/**
 * Send Email DTO
 *
 * Parameters for sending email
 */
export class SendEmailDto {
  @IsString()
  to: string; // 收件人邮箱

  @IsString()
  subject: string; // 邮件主题

  @IsString()
  template: string; // 邮件模板名称

  @IsObject()
  data: Record<string, unknown>; // 模板变量数据

  @IsOptional()
  @IsString()
  cc?: string; // 抄送邮箱

  @IsOptional()
  @IsArray()
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer | string;
  }>; // 附件列表
}
