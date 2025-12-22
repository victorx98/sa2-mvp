import { ApiProperty } from '@nestjs/swagger';
import { RecommLetterEntity } from '@domains/services/recomm-letter/entities/recomm-letter.entity';

/**
 * Letter Type Info (simplified for response)
 */
export class LetterTypeInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;
}

/**
 * Recommendation Letter Response DTO
 */
export class RecommLetterResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  studentUserId: string;

  @ApiProperty({ type: () => LetterTypeInfoDto, required: false })
  letterType?: LetterTypeInfoDto;

  @ApiProperty({ type: () => LetterTypeInfoDto, required: false })
  packageType?: LetterTypeInfoDto;

  @ApiProperty()
  serviceType: string;

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
  mentorUserId?: string;

  @ApiProperty({ required: false })
  billedAt?: Date;

  static fromEntity(entity: RecommLetterEntity, letterType?: LetterTypeInfoDto, packageType?: LetterTypeInfoDto): RecommLetterResponseDto {
    return {
      id: entity.getId(),
      studentUserId: entity.getStudentUserId(),
      letterType,
      packageType,
      serviceType: entity.getServiceType(),
      fileName: entity.getFileName(),
      fileUrl: entity.getFileUrl(),
      status: entity.getStatus(),
      uploadedBy: entity.getUploadedBy(),
      createdAt: entity.getCreatedAt(),
      updatedAt: entity.getUpdatedAt(),
      description: entity.getDescription(),
      mentorUserId: entity.getMentorUserId(),
      billedAt: entity.getBilledAt(),
    };
  }

  static fromEntities(entities: RecommLetterEntity[]): RecommLetterResponseDto[] {
    return entities.map(entity => RecommLetterResponseDto.fromEntity(entity));
  }
}

