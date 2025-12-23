import { ApiProperty } from '@nestjs/swagger';
import { ResumeEntity } from '@domains/services/resume/entities/resume.entity';

/**
 * Resume Response DTO
 */
export class ResumeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  studentUserId: string;

  @ApiProperty()
  jobTitle: string;

  @ApiProperty()
  sessionType: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  fileUrl: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  uploadedBy: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  finalSetAt?: Date;

  @ApiProperty({ required: false })
  mentorUserId?: string;

  @ApiProperty({ required: false })
  billedBy?: string;

  @ApiProperty({ required: false })
  billedAt?: Date;

  static fromEntity(entity: ResumeEntity): ResumeResponseDto {
    return {
      id: entity.getId(),
      studentUserId: entity.getStudentUserId(),
      jobTitle: entity.getJobTitle(),
      sessionType: entity.getSessionType(),
      fileName: entity.getFileName(),
      fileUrl: entity.getFileUrl(),
      status: entity.getStatus(),
      uploadedBy: entity.getUploadedBy(),
      createdAt: entity.getCreatedAt(),
      updatedAt: entity.getUpdatedAt(),
      description: entity.getDescription(),
      finalSetAt: entity.getFinalSetAt(),
      mentorUserId: entity.getMentorUserId(),
      billedBy: entity.getBilledBy(),
      billedAt: entity.getBilledAt(),
    };
  }

  static fromEntities(entities: ResumeEntity[]): ResumeResponseDto[] {
    return entities.map(ResumeResponseDto.fromEntity);
  }

  static groupedFromEntities(grouped: Record<string, ResumeEntity[]>): Record<string, ResumeResponseDto[]> {
    const result: Record<string, ResumeResponseDto[]> = {};
    for (const [key, entities] of Object.entries(grouped)) {
      result[key] = ResumeResponseDto.fromEntities(entities);
    }
    return result;
  }
}

