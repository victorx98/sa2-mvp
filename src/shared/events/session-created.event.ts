/**
 * Application-level Event - Session Created (应用层事件 - 会话已创建)
 * 在会话成功创建后触发，用于通知其他模块进行后续处理
 * Contract Domain 使用此事件来更新 ServiceHold 的关联关系
 *
 * This event follows the event-driven architecture pattern,
 * enabling loose coupling between Contract Domain and Session Domain.
 * (此事件遵循事件驱动架构模式，实现 Contract Domain 与 Session Domain 的松耦合)
 */

export const SESSION_CREATED_EVENT = "session.created";

/**
 * Payload for session.created event (session.created 事件的负载)
 */
export interface SessionCreatedEvent {
  sessionId: string; // Session ID (会话ID)
  holdId: string; // Service hold ID (服务预留ID)
  contractId: string; // Contract ID (合约ID)
  studentId: string; // Student ID (学生ID)
  mentorId: string; // Mentor ID (导师ID)
  serviceType: string; // Service type (服务类型)
}
