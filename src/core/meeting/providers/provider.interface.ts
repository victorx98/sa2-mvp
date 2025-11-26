/**
 * Meeting Provider Interface
 *
 * Unified interface for different meeting platforms (Feishu, Zoom, etc.)
 */

// Meeting provider type enum
export enum MeetingProviderType {
  FEISHU = "feishu",
  ZOOM = "zoom",
}

// Create meeting input interface
export interface ICreateMeetingInput {
  topic: string; // Meeting topic
  startTime: Date; // Start time
  duration: number; // Duration in minutes
  hostUserId?: string; // Platform-specific host user ID (e.g., Feishu user ID)
  autoRecord?: boolean; // Enable auto-recording (passed to provider, not saved in DB)
  enableWaitingRoom?: boolean; // Enable waiting room (not supported by Feishu)
  participantJoinEarly?: boolean; // Allow participants to join early
}

// Update meeting input interface
export interface IUpdateMeetingInput {
  topic?: string; // Meeting topic
  startTime?: Date; // Start time
  duration?: number; // Duration in minutes
  autoRecord?: boolean; // Enable auto-recording (passed to provider, not saved in DB)
}

// Meeting info interface (v4.1)
export interface IMeetingInfo {
  provider: MeetingProviderType; // Meeting platform
  meetingNo: string | null; // Meeting number (Feishu 9-digit, Zoom null)
  reserveId: string; // Reserve ID - Feishu reserve_id or Zoom meeting_id (for update/cancel) - v4.1
  meetingUrl: string; // Meeting link
  meetingPassword: string | null; // Meeting password
  hostJoinUrl: string | null; // Host-only join URL (Zoom only)
  startTime: Date; // Start time
  duration: number; // Duration in minutes
}

// Meeting provider interface
export interface IMeetingProvider {
  /**
   * Create a meeting
   * @param input - Meeting creation parameters
   * @returns Meeting information
   */
  createMeeting(input: ICreateMeetingInput): Promise<IMeetingInfo>;

  /**
   * Update a meeting (v4.1)
   * @param reserveId - Reserve ID (Feishu reserve_id or Zoom meeting_id)
   * @param input - Meeting update parameters
   * @returns Success status
   */
  updateMeeting(
    reserveId: string,
    input: IUpdateMeetingInput,
  ): Promise<boolean>;

  /**
   * Cancel a meeting (v4.1)
   * @param reserveId - Reserve ID (Feishu reserve_id or Zoom meeting_id)
   * @returns Success status
   */
  cancelMeeting(reserveId: string): Promise<boolean>;

  /**
   * Get meeting information
   * @param reserveId - Reserve ID (Feishu reserve_id or Zoom meeting_id)
   * @returns Meeting information
   */
  getMeetingInfo(reserveId: string): Promise<IMeetingInfo>;
}

