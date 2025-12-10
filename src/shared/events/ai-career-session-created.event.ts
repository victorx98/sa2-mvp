/**
 * Application-level Event - AI Career Session Created
 * 应用层事件 - AI Career 会话已创建
 *
 * Triggered after an AI Career session record is successfully created.
 * Used to asynchronously create meeting and update related information.
 * 在 AI Career 会话记录成功创建后触发。
 * 用于异步创建会议并更新相关信息。
 *
 * This event follows the event-driven architecture pattern for async operations.
 * 此事件遵循事件驱动架构模式实现异步操作。
 */

export const AI_CAREER_SESSION_CREATED_EVENT = 'ai_career.session.created';

/**
 * Payload for ai_career.session.created event
 * ai_career.session.created 事件的负载
 */
export interface AiCareerSessionCreatedEvent {
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

