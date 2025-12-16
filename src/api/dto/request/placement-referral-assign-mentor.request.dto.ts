import { IsString, Length } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * Assign referral mentor request DTO [内推指定导师请求DTO]
 */
export class PlacementReferralAssignMentorRequestDto {
  @ApiProperty({
    description:
      "Mentor user ID (UUID string). Assigns mentor to a referral application. [导师用户ID(UUID字符串)，用于内推投递分配导师]",
    type: String,
    required: true,
    format: "uuid",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsString()
  @Length(36, 36)
  mentorId!: string; // Mentor user ID (string UUID) [导师用户ID（字符串UUID）]
}


