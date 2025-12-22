import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID, IsObject, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { APPLICATION_STATUSES } from "@domains/placement/types/application-status.types";
import type { ApplicationStatus } from "@domains/placement/types";

/**
 * Change metadata for status update [状态变更的元数据]
 */
class ChangeMetadata {
  @ApiPropertyOptional({ description: "Additional context [额外上下文]" })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Previous status [之前的投递状态]" })
  @IsOptional()
  @IsString()
  previousStatus?: string;

  @ApiPropertyOptional({ description: "Operation timestamp [操作时间戳]" })
  @IsOptional()
  timestamp?: string;
}

/**
 * Request DTO for updating job application status at API layer [用于API层更新投递状态的请求DTO]
 *
 * This DTO contains all fields required for status update operation, whether they come from URL parameters, request body, or server-generated values.
 * 此DTO包含状态更新操作所需的所有字段，无论这些字段来自URL参数、请求体还是服务端生成的值。
 */
export class PlacementJobApplicationUpdateStatusRequestDto {
  @ApiProperty({
    description: "Application ID (UUID) [投递ID(UUID)]",
    type: String,
    format: "uuid",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID("4", { message: "applicationId must be a valid UUID [applicationId必须是有效的UUID]" })
  @IsString()
  applicationId!: string; // Unique identifier of the job application [投递的唯一标识符]

  @ApiProperty({
    description: "Target status of the application [目标投递状态]",
    enum: APPLICATION_STATUSES,
    example: "interested",
  })
  @IsEnum(APPLICATION_STATUSES, {
    message:
      "status must be one of the allowed application statuses [status必须是允许的投递状态之一]",
  })
  status!: ApplicationStatus; // Desired application status [目标投递状态]

  @ApiPropertyOptional({
    description: "Assigned mentor ID (UUID) [分配的导师ID(UUID)]",
    type: String,
    format: "uuid",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  @IsOptional()
  @IsUUID("4", { message: "mentorId must be a valid UUID [mentorId必须是有效的UUID]" })
  mentorId?: string; // ID of the assigned mentor for referral applications [内推投递分配的导师ID]

  @ApiPropertyOptional({
    description: "Changed by user ID (UUID) [变更人用户ID(UUID)]",
    type: String,
    format: "uuid",
    example: "123e4567-e89b-12d3-a456-426614174002",
  })
  @IsOptional()
  @IsUUID("4", { message: "changedBy must be a valid UUID [changedBy必须是有效的UUID]" })
  changedBy?: string; // ID of the user who made the change [执行变更的用户ID]

  @ApiPropertyOptional({
    description: "Reason for status change [状态变更原因]",
    type: String,
    example: "Assign referral mentor",
  })
  @IsOptional()
  @IsString()
  changeReason?: string; // Human-readable explanation for the status change [状态变更的人工可读解释]

  @ApiPropertyOptional({
    description: "Metadata about the change operation [变更操作的元数据]",
    type: ChangeMetadata,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ChangeMetadata)
  changeMetadata?: ChangeMetadata; // Additional context about the change [关于变更的额外上下文]
}

