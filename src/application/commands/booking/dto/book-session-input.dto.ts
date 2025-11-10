/**
 * Application Layer - Book Session Input DTO
 * 用于 BookSessionCommand 的输入参数
 */
import type { ServiceType } from "@domains/contract/common/types/enum.types";

export interface BookSessionInput {
  // 预约发起人
  counselorId: string;

  // 学生和导师
  studentId: string;
  mentorId: string;

  // 合同和服务
  contractId: string;
  serviceType: ServiceType; // 服务类型（枚举值，如：individual_session, gap_analysis）

  // 时间安排
  scheduledStartTime: Date;
  scheduledEndTime: Date;
  duration: number; // 分钟

  // 会议信息
  topic: string;
  meetingProvider?: string; // 'zoom' | 'teams' | 'feishu'
}
