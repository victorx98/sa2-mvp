import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsString,
} from "class-validator";

/**
 * Batch recommend referral applications request DTO [批量内推推荐请求DTO]
 */
export class PlacementReferralBatchRecommendRequestDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  studentIds!: string[]; // Student IDs [学生ID列表]

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  jobIds!: string[]; // Job IDs [岗位ID列表]
}


