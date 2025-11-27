/**
 * Job position created event [岗位创建事件]
 * Published when a new job position is created [发布新岗位创建时]
 */
export const JOB_POSITION_CREATED_EVENT = "placement.position.created";

/**
 * Interface for job position created event payload [岗位创建事件载荷接口]
 */
export interface JobPositionCreatedEvent {
  positionId: string; // Position ID [岗位ID]
  title: string; // Job title [岗位标题]
  companyName: string; // Company name [公司名称]
  jobSource: "web" | "bd"; // Job source (web or business development) [岗位来源]
  locations?: Array<{
    city: string;
    state?: string;
    country: string;
    address?: string;
    isPrimary: boolean;
  }>; // Location list [地点列表]
  aiAnalysis?: any; // AI analysis results [AI分析结果]
  createdBy: string; // Creator ID [创建人ID]
  createdAt: string; // Creation time [创建时间]
}

/**
 * Job position status changed event [岗位状态变更事件]
 * Published when a job position status changes [发布岗位状态变更时]
 */
export const JOB_POSITION_STATUS_CHANGED_EVENT = "placement.position.status_changed";

/**
 * Interface for job position status changed event payload [岗位状态变更事件载荷接口]
 */
export interface JobPositionStatusChangedEvent {
  positionId: string; // Position ID [岗位ID]
  previousStatus: "active" | "inactive" | "expired"; // Previous status [之前状态]
  newStatus: "active" | "inactive" | "expired"; // New status [新状态]
  changedBy: string; // Changer ID [变更人ID]
  changedAt: string; // Change time [变更时间]
  changeReason?: string; // Change reason [变更原因]
}

/**
 * Job position expired event [岗位过期事件]
 * Published when a job position is marked as expired [发布岗位标记过期时]
 */
export const JOB_POSITION_EXPIRED_EVENT = "placement.position.expired";

/**
 * Interface for job position expired event payload [岗位过期事件载荷接口]
 */
export interface JobPositionExpiredEvent {
  positionId: string; // Position ID [岗位ID]
  expiredBy: string; // Person who expired the position [过期操作人]
  expiredByType: "student" | "mentor" | "counselor" | "bd"; // Type of person who expired [过期人类型]
  expiredAt: string; // Expiration time [过期时间]
  reason?: string; // Expiration reason [过期原因]
}
