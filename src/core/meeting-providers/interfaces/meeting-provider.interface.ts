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
  autoRecord?: boolean; // Enable auto-recording
  enableWaitingRoom?: boolean; // Enable waiting room (not supported by Feishu)
  participantJoinEarly?: boolean; // Allow participants to join early
}

// Update meeting input interface
export interface IUpdateMeetingInput {
  topic?: string; // Meeting topic
  startTime?: Date; // Start time
  duration?: number; // Duration in minutes
  autoRecord?: boolean; // Enable auto-recording
}

// Meeting info interface
export interface IMeetingInfo {
  provider: MeetingProviderType; // Meeting platform
  meetingId: string; // Third-party meeting ID
  meetingNo: string | null; // Meeting number (Feishu 9-digit, Zoom null)
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
   * Update a meeting
   * @param meetingId - Meeting ID
   * @param input - Meeting update parameters
   * @returns Success status
   */
  updateMeeting(
    meetingId: string,
    input: IUpdateMeetingInput,
  ): Promise<boolean>;

  /**
   * Cancel a meeting
   * @param meetingId - Meeting ID
   * @returns Success status
   */
  cancelMeeting(meetingId: string): Promise<boolean>;

  /**
   * Get meeting information
   * @param meetingId - Meeting ID
   * @returns Meeting information
   */
  getMeetingInfo(meetingId: string): Promise<IMeetingInfo>;
}
