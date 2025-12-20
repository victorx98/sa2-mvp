/**
 * Service Types Constants [服务类型常量]
 *
 * 定义所有服务类型的常量值，避免魔法字符串
 * Defines constant values for all service types to avoid magic strings
 */

export const SERVICE_TYPES = {
  /**
   * Resume review service [简历修改服务]
   */
  RESUME_REVIEW: 'resume_review',

  /**
   * Class service [班课服务]
   */
  CLASS: 'class',

  /**
   * One-on-one mentoring session [一对一辅导会话]
   */
  ONE_ON_ONE_SESSION: 'one_on_one_session',

  /**
   * Gap analysis session [GAP分析会话]
   */
  GAP_ANALYSIS: 'gap_analysis',

  /**
   * AI career planning session [AI职业规划会话]
   */
  AI_CAREER: 'ai_career',

  /**
   * Consultation service [咨询服务]
   */
  CONSULTATION: 'consultation',

  /**
   * Mentoring service [辅导服务]
   */
  MENTORING: 'mentoring',
} as const;

/**
 * Booking Source Constants [预约来源常量]
 *
 * 定义所有数据库表名的常量值，用于 service_ledgers.metadata.bookingSource
 * Defines constant values for all database table names, used in service_ledgers.metadata.bookingSource
 */
export const BOOKING_SOURCES = {
  /**
   * Resumes table [简历表]
   */
  RESUMES: 'resumes',

  /**
   * Classes table [班级表]
   */
  CLASSES: 'classes',

  /**
   * Class sessions table [班课会话表]
   */
  CLASS_SESSIONS: 'class_sessions',

  /**
   * Regular mentoring sessions table [常规辅导会话表]
   */
  REGULAR_MENTORING_SESSIONS: 'regular_mentoring_sessions',

  /**
   * Gap analysis sessions table [GAP分析会话表]
   */
  GAP_ANALYSIS_SESSIONS: 'gap_analysis_sessions',

  /**
   * AI career sessions table [AI职业规划会话表]
   */
  AI_CAREER_SESSIONS: 'ai_career_sessions',

  /**
   * Job applications table [职位申请表]
   */
  JOB_APPLICATIONS: 'job_applications',
} as const;

/**
 * Service Source Constants [服务来源常量]
 *
 * 定义服务台账记录的来源类型
 * Defines source types for service ledger entries
 */
export const SERVICE_SOURCES = {
  /**
   * Booking completed [预约完成]
   */
  BOOKING_COMPLETED: 'booking_completed',

  /**
   * Booking cancelled [预约取消]
   */
  BOOKING_CANCELLED: 'booking_cancelled',

  /**
   * Manual adjustment [手动调整]
   */
  MANUAL_ADJUSTMENT: 'manual_adjustment',

  /**
   * Session completed [会话完成]
   */
  SESSION_COMPLETED: 'session_completed',
} as const;
