import { ApiProperty } from '@nestjs/swagger';

/**
 * Operations Layer - Session Detail Response DTO
 * 会话详情响应DTO（返回给顾问端前端）
 *
 * 参考 application_bff_both_need.md 5.2 节
 * BFF层职责：
 * 1. Entity → DTO 转换
 * 2. 添加前端特定的提示信息
 * 3. 添加可用操作按钮
 */
export class SessionDetailResponseDto {
  @ApiProperty({
    description: '预约ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  bookingId: string;

  @ApiProperty({
    description: '预约时间',
    example: '2025-11-10T14:00:00Z',
  })
  scheduledAt: Date;

  @ApiProperty({
    description: '会话时长（分钟）',
    example: 60,
  })
  duration: number;

  @ApiProperty({
    description: '会话状态',
    example: 'scheduled',
  })
  status: string;

  @ApiProperty({
    description: '状态文本（中文）',
    example: '已预约',
  })
  statusText: string;

  @ApiProperty({
    description: '导师信息',
  })
  mentor: {
    id: string;
    name: string;
    avatar?: string;
    company?: string;
    position?: string;
  };

  @ApiProperty({
    description: '学生信息',
  })
  student: {
    id: string;
    name: string;
  };

  @ApiProperty({
    description: '服务信息',
  })
  service: {
    id: string;
    name: string;
    type: string;
  };

  @ApiProperty({
    description: '定价信息',
  })
  pricing: {
    cost: number;
    currency: string;
    remainingBalance: number;
  };

  @ApiProperty({
    description: '会议信息',
  })
  meeting?: {
    url?: string;
    password?: string;
    provider?: string;
  };

  @ApiProperty({
    description: '可用操作',
  })
  actions: {
    canCancel: boolean;
    cancelDeadline?: Date;
  };

  @ApiProperty({
    description: '提示信息',
    example: ['预约已确认', '请提前5分钟准备', '如需取消请至少提前24小时'],
  })
  hints: string[];
}
