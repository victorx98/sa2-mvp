/**
 * Email Attachment Interface
 */
export interface IEmailAttachment {
  filename: string; // 附件文件名
  path?: string; // 文件路径
  content?: Buffer | string; // 文件内容
  contentType?: string; // MIME类型
}

/**
 * Email Sending Parameters
 */
export interface ISendEmailParams {
  to: string; // 收件人邮箱
  subject: string; // 邮件主题
  template: string; // 邮件模板名称
  data: Record<string, unknown>; // 模板变量数据
  cc?: string; // 抄送邮箱
  attachments?: IEmailAttachment[]; // 附件列表
}
