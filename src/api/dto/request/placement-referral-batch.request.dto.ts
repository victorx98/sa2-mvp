import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsString,
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
}


