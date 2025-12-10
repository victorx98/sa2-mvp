/**
 * Application-level Event - Gap Analysis Session Created
 * 应用层事件 - Gap Analysis 会话已创建
 *
 * Triggered after a Gap Analysis session record is successfully created.
 * Used to asynchronously create meeting and update related information.
 * 在 Gap Analysis 会话记录成功创建后触发。
 * 用于异步创建会议并更新相关信息。
 *
 * This event follows the event-driven architecture pattern for async operations.
 * 此事件遵循事件驱动架构模式实现异步操作。
 */

export const GAP_ANALYSIS_SESSION_CREATED_EVENT = 'gap_analysis.session.created';

/**
 * Payload for gap_analysis.session.created event
 * gap_analysis.session.created 事件的负载
 */
export interface GapAnalysisSessionCreatedEvent {
  sessionId: string;              // Session ID (会话ID)
  studentId: string;              // Student ID (学生ID)
  mentorId: string;               // Mentor ID (导师ID)
  counselorId: string;            // Counselor ID (顾问ID)
  scheduledStartTime: string;     // Scheduled start time ISO string (计划开始时间)
  duration: number;               // Duration in minutes (时长，分钟)
  meetingProvider: string;        // Meeting provider: 'feishu' | 'zoom' (会议提供商)
  topic: string;                  // Session topic (会话主题)
  mentorCalendarSlotId: string;   // Mentor's Calendar Slot ID (导师日历槽位ID)
  studentCalendarSlotId: string;  // Student's Calendar Slot ID (学生日历槽位ID)
}

