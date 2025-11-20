import { MeetingProviderType } from "../providers/provider.interface";

/**
 * Meeting Info DTO
 *
 * Output DTO for meeting information
 */
export class MeetingInfoDto {
  provider: MeetingProviderType; // Meeting platform
  meetingId: string; // Third-party meeting ID
  meetingNo: string | null; // Meeting number (Feishu 9-digit, Zoom null)
  meetingUrl: string; // Meeting link
  meetingPassword: string | null; // Meeting password
  hostJoinUrl: string | null; // Host-only join URL (Zoom only)
  startTime: Date; // Start time
  duration: number; // Duration in minutes
}

