/**
 * Application Layer - Book Session Output DTO
 * BookSessionUseCase 的返回结果
 */
export interface BookSessionOutput {
  // 会话信息
  sessionId: string;
  studentId: string;
  mentorId: string;
  contractId: string;
  serviceId: string;

  // 时间信息
  scheduledStartTime: Date;
  scheduledEndTime: Date;
  duration: number;

  // 会议信息
  meetingUrl?: string;
  meetingPassword?: string;
  meetingProvider?: string;

  // 状态
  status: string;

  // 关联ID
  calendarSlotId?: string;
  serviceHoldId?: string;
}
