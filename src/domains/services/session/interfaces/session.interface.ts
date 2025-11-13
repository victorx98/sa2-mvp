// Session status enum
export enum SessionStatus {
  SCHEDULED = "scheduled",
  STARTED = "started",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

// Meeting provider enum
export enum MeetingProvider {
  FEISHU = "feishu",
  ZOOM = "zoom",
}

// Recording structure
export interface IRecording {
  recordingId: string; // Recording file ID
  recordingUrl: string; // Recording file URL
  transcriptUrl: string | null; // Transcript URL
  duration: number; // Recording duration in seconds
  sequence: number; // Recording sequence number (supports multiple recordings)
  startedAt: Date; // Recording start time
  endedAt: Date; // Recording end time
}

// AI Summary structure
export interface IAISummary {
  summary: string; // Main summary content
  topics?: string[]; // Key topics discussed
  keyPoints?: string[]; // Important points covered
  suggestions?: string[]; // Recommendations for student
  durationAnalysis?: {
    effectiveMinutes: number; // Effective tutoring duration in minutes
    topicBreakdown?: Record<string, number>; // Time breakdown by topic
  };
}

// Session entity interface (matches database table)
export interface ISessionEntity {
  id: string; // UUID primary key
  studentId: string; // Student user ID
  mentorId: string; // Mentor user ID
  contractId: string | null; // Associated contract ID

  // Meeting information
  meetingProvider: string; // 'feishu' | 'zoom'
  meetingNo: string | null; // Feishu meeting number (9 digits) - key field for webhook association
  meetingUrl: string | null; // Meeting link
  meetingPassword: string | null; // Meeting password

  // Scheduled time
  scheduledStartTime: Date; // Planned start time
  scheduledDuration: number; // Planned duration in minutes

  // Actual time (updated by webhook)
  actualStartTime: Date | null; // Actual start time
  actualEndTime: Date | null; // Actual end time

  // Recordings (array, supports multiple recordings)
  recordings: IRecording[]; // Recording array

  // AI summary (structured data)
  aiSummary: IAISummary | null; // AI summary object

  // Duration statistics
  mentorTotalDurationSeconds: number | null; // Mentor total online duration in seconds
  studentTotalDurationSeconds: number | null; // Student total online duration in seconds
  effectiveTutoringDurationSeconds: number | null; // Effective tutoring duration in seconds
  mentorJoinCount: number; // Mentor join count
  studentJoinCount: number; // Student join count

  // Business fields
  sessionName: string; // Session name
  notes: string | null; // Notes

  // Status
  status: SessionStatus; // Session status

  // Audit fields
  createdAt: Date; // Created timestamp
  updatedAt: Date; // Updated timestamp
  deletedAt: Date | null; // Soft delete timestamp
}
