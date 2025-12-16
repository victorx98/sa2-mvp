import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { APPLICATION_STATUSES } from "@domains/placement/types/application-status.types";
import type { ApplicationStatus } from "@domains/placement/types";

/**
 * Request DTO for updating job application status at API layer [用于API层更新投递状态的请求DTO]
 */
export class PlacementJobApplicationUpdateStatusRequestDto {
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
}

