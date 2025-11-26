import { MeetingProviderType } from "../providers/provider.interface";

/**
 * Meeting Info DTO (v4.1)
 *
 * Output DTO for meeting information
 */
export class MeetingInfoDto {
  provider: MeetingProviderType; // Meeting platform
  meetingNo: string | null; // Meeting number (Feishu 9-digit, Zoom null)
  reserveId: string; // Reserve ID (Feishu reserve_id, Zoom meeting_id) - v4.1
  meetingUrl: string; // Meeting link
  meetingPassword: string | null; // Meeting password
  hostJoinUrl: string | null; // Host-only join URL (Zoom only)
  startTime: Date; // Start time
  duration: number; // Duration in minutes
}

