/**
 * Create Session Response DTO
 */
export class CreateSessionResponseDto {
  sessionId: string;
  status: string;
  scheduledAt: string;
  holdId?: string;
}

