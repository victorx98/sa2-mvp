/**
 * Application Layer - Book Session Input DTO
 * 用于 BookSessionCommand 的输入参数
 */
export interface BookSessionInput {
  // 预约发起人
  counselorId: string;

  // 学生和导师
  studentId: string;
  mentorId: string;

  // 服务类型
  serviceType: string;

  // 时间安排
  scheduledStartTime: string;
  duration: number; // 分钟

  // 会议信息
  topic: string;
  meetingProvider?: string; // 'zoom' | 'teams' | 'feishu'
}
