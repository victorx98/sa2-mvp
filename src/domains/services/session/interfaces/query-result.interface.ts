/**
 * Paginated Result Interface
 *
 * Generic paginated result structure
 */
export interface IPaginatedResult<T> {
  data: T[]; // Data array
  total: number; // Total records
  page: number; // Current page
  limit: number; // Items per page
  totalPages: number; // Total pages
  hasNext: boolean; // Has next page
  hasPrev: boolean; // Has previous page
}

/**
 * Session Statistics Interface
 *
 * Statistics for session queries
 */
export interface ISessionStats {
  totalSessions: number; // Total session count
  completedSessions: number; // Completed session count
  cancelledSessions: number; // Cancelled session count
  totalDurationHours: number; // Total duration in hours
  averageDurationMinutes: number; // Average duration in minutes
  completionRate: number; // Completion rate (percentage)
}

/**
 * Date Range DTO
 */
export interface IDateRange {
  startDate: Date;
  endDate: Date;
}
