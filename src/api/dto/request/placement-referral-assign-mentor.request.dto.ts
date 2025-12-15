import { IsString, Length } from "class-validator";

/**
 * Assign referral mentor request DTO [内推指定导师请求DTO]
 */
export class PlacementReferralAssignMentorRequestDto {
  @IsString()
  @Length(36, 36)
  mentorId!: string; // Mentor user ID (string UUID) [导师用户ID（字符串UUID）]
}


