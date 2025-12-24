import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsString,
  IsOptional,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * Batch recommend referral applications request DTO [批量内推推荐请求DTO]
 */
export class PlacementReferralBatchRecommendRequestDto {
  @ApiProperty({
    description:
      "Student IDs (UUID strings). Unique and non-empty. [学生ID(UUID字符串)列表，需去重且非空]",
    type: [String],
    isArray: true,
    required: true,
    example: ["123e4567-e89b-12d3-a456-426614174000"],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  studentIds!: string[]; // Student IDs [学生ID列表]

  @ApiProperty({
    description:
      "Job IDs (UUID). Unique and non-empty. [岗位ID(UUID)列表，需去重且非空]",
    type: [String],
    isArray: true,
    required: true,
    example: ["123e4567-e89b-12d3-a456-426614174001"],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  jobIds!: string[]; // Job IDs [岗位ID列表]

  @ApiProperty({
    description:
      "Recommended by (UUID). The ID of the counselor who recommends the jobs. If not provided, defaults to the current user from JWT. [推荐人ID(UUID)，推荐岗位的顾问ID。如果不提供，默认使用JWT中的当前用户]",
    type: String,
    required: false,
    example: "123e4567-e89b-12d3-a456-426614174002",
  })
  @IsString()
  @IsOptional()
  recommendedBy?: string; // Recommended by [推荐人ID]
}


