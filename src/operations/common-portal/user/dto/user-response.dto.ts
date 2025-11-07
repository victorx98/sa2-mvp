import { ApiProperty } from '@nestjs/swagger';

/**
 * BFF Layer - User Response DTO
 * 职责：为前端提供用户信息的响应格式
 * 特点：添加前端需要的格式化字段和操作提示
 */
export class UserResponseDto {
  @ApiProperty({ description: '用户ID' })
  id: string;

  @ApiProperty({ description: '邮箱' })
  email: string;

  @ApiProperty({ description: '英文昵称', required: false })
  nickname?: string;

  @ApiProperty({ description: '中文昵称', required: false })
  cnNickname?: string;

  @ApiProperty({ description: '用户状态' })
  status: string;

  @ApiProperty({ description: '状态显示文本（前端友好）' })
  statusText: string;

  @ApiProperty({ description: '状态颜色标记（前端使用）' })
  statusColor: string;

  @ApiProperty({ description: '显示名称（优先显示中文昵称）' })
  displayName: string;

  @ApiProperty({ description: '头像URL（如果没有则返回默认头像）', required: false })
  avatar?: string;

  @ApiProperty({ description: '可用操作按钮', required: false })
  actions?: Array<{
    label: string;
    action: string;
    icon?: string;
  }>;
}
