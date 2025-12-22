/**
 * Create Class Session Response DTO
 */
export class CreateClassSessionResponseDto {
  sessionId: string;
  status: string;
  scheduledAt: string;
}

/**
 * Update Class Session Response DTO
 */
export class UpdateClassSessionResponseDto {
  sessionId: string;
  updated: boolean;
}

/**
 * Cancel Class Session Response DTO
 */
export class CancelClassSessionResponseDto {
  sessionId: string;
  status: string;
}

/**
 * Delete Class Session Response DTO
 */
export class DeleteClassSessionResponseDto {
  sessionId: string;
  status: string;
}

