import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString, IsInt, Min, IsNumber, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ClassType, ClassStatus } from '@domains/services/class';

/**
 * Create Class Request DTO
 */
export class CreateClassRequestDto {
  @ApiProperty({
    description: 'Class name',
    example: 'Spring 2025 Career Mentoring',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Class type',
    enum: ClassType,
    example: ClassType.SESSION,
  })
  @IsEnum(ClassType)
  @IsNotEmpty()
  type: ClassType;

  @ApiProperty({
    description: 'Start date (ISO 8601)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    description: 'End date (ISO 8601)',
    example: '2025-06-30T23:59:59Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: 'Class description',
    example: 'Comprehensive career mentoring program',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Total number of sessions',
    example: 10,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  totalSessions?: number;
}

/**
 * Update Class Request DTO
 */
export class UpdateClassRequestDto {
  @ApiProperty({
    description: 'Class name',
    example: 'Spring 2025 Career Mentoring',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Start date (ISO 8601)',
    example: '2025-01-01T00:00:00Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'End date (ISO 8601)',
    example: '2025-06-30T23:59:59Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: 'Class description',
    example: 'Comprehensive career mentoring program',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Total number of sessions',
    example: 10,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  totalSessions?: number;
}

/**
 * Update Class Status Request DTO
 */
export class UpdateClassStatusRequestDto {
  @ApiProperty({
    description: 'Class status',
    enum: ClassStatus,
    example: ClassStatus.ACTIVE,
  })
  @IsEnum(ClassStatus)
  @IsNotEmpty()
  status: ClassStatus;
}

/**
 * Add Mentor Request DTO
 */
export class AddMentorRequestDto {
  @ApiProperty({
    description: 'Mentor user ID',
    example: '4903b94b-67cc-42a1-9b3e-91ebc51bcefc',
  })
  @IsString()
  @IsNotEmpty()
  mentorUserId: string;

  @ApiProperty({
    description: 'Price per session',
    example: 100,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  pricePerSession: number;
}

/**
 * Update Class Mentor Price Request DTO
 */
export class UpdateClassMentorPriceInClassRequestDto {
  @ApiProperty({
    description: 'Price per session',
    example: 120,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  pricePerSession: number;
}

/**
 * Add Student Request DTO
 */
export class AddStudentRequestDto {
  @ApiProperty({
    description: 'Student user ID',
    example: '9e50af7d-5f08-4516-939f-7f765ce131b8',
  })
  @IsString()
  @IsNotEmpty()
  studentUserId: string;
}

/**
 * Add Counselor Request DTO
 */
export class AddCounselorRequestDto {
  @ApiProperty({
    description: 'Counselor user ID',
    example: '7f123abc-4d56-78ef-90ab-cd1234567890',
  })
  @IsString()
  @IsNotEmpty()
  counselorUserId: string;
}

/**
 * Get Classes Query DTO
 */
export class GetClassesQueryDto {
  @ApiProperty({
    description: 'Page number',
    example: 1,
    required: false,
    default: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({
    description: 'Page size (max 100)',
    example: 10,
    required: false,
    default: 10,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 10;

  @ApiProperty({
    description: 'Sort field',
    example: 'createdAt',
    required: false,
    default: 'createdAt',
  })
  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiProperty({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc',
    required: false,
    default: 'desc',
  })
  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiProperty({
    description: 'Filter by status',
    enum: ClassStatus,
    required: false,
  })
  @IsEnum(ClassStatus)
  @IsOptional()
  status?: ClassStatus;

  @ApiProperty({
    description: 'Filter by type',
    enum: ClassType,
    required: false,
  })
  @IsEnum(ClassType)
  @IsOptional()
  type?: ClassType;

  @ApiProperty({
    description: 'Filter by created by me (current user)',
    example: true,
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  createdByMe?: boolean;

  @ApiProperty({
    description: 'Filter by class name (fuzzy search)',
    example: '春季',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}

