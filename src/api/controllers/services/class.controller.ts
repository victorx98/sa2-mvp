import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { User } from '@domains/identity/user/user-interface';
import { ApiPrefix } from '@api/api.constants';
import { ClassService } from '@application/commands/services/class.service';
import { ClassType, ClassStatus } from '@domains/services/class/classes/entities/class.entity';

// ============================================================================
// DTOs - Request
// ============================================================================

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString, IsInt, Min, IsNumber } from 'class-validator';

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

export class UpdateMentorPriceRequestDto {
  @ApiProperty({
    description: 'Price per session',
    example: 120,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  pricePerSession: number;
}

export class AddStudentRequestDto {
  @ApiProperty({
    description: 'Student user ID',
    example: '9e50af7d-5f08-4516-939f-7f765ce131b8',
  })
  @IsString()
  @IsNotEmpty()
  studentUserId: string;
}

export class AddCounselorRequestDto {
  @ApiProperty({
    description: 'Counselor user ID',
    example: '7f123abc-4d56-78ef-90ab-cd1234567890',
  })
  @IsString()
  @IsNotEmpty()
  counselorUserId: string;
}

// ============================================================================
// DTOs - Response
// ============================================================================

export class CreateClassResponseDto {
  classId: string;
  name: string;
  type: string;
  status: string;
}

export class UpdateClassResponseDto {
  classId: string;
  updated: boolean;
}

export class ClassStatusResponseDto {
  classId: string;
  status: string;
}

export class AddMemberResponseDto {
  classId: string;
  added: boolean;
  mentorId?: string;
  studentId?: string;
  counselorId?: string;
}

export class RemoveMemberResponseDto {
  classId: string;
  removed: boolean;
  mentorId?: string;
  studentId?: string;
  counselorId?: string;
}

// ============================================================================
// Controller
// ============================================================================

/**
 * API Layer - Class Management Controller
 *
 * Responsibility:
 * - Define HTTP routes for class management
 * - Extract and validate request parameters
 * - Call Application Layer services
 * - Return HTTP responses
 *
 * Route: /api/services/classes
 */
@ApiTags('Services - Class Management')
@Controller(`${ApiPrefix}/services/classes`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ClassController {
  constructor(
    private readonly classService: ClassService,
  ) {}

  /**
   * Create a new class
   * POST /api/services/classes
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'admin')
  @ApiOperation({
    summary: 'Create a new class',
    description: 'Create a new class with basic information',
  })
  @ApiCreatedResponse({
    description: 'Class created successfully',
    type: CreateClassResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  async createClass(
    @CurrentUser() user: User,
    @Body() dto: CreateClassRequestDto,
  ): Promise<CreateClassResponseDto> {
    return this.classService.createClass({
      name: dto.name,
      type: dto.type,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      description: dto.description,
      totalSessions: dto.totalSessions,
    });
  }

  /**
   * Get class details
   * GET /api/services/classes/:id
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get class details',
    description: 'Retrieve detailed information about a specific class',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Class retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Class not found',
  })
  async getClassDetail(
    @Param('id') classId: string,
  ) {
    return this.classService.getClassById(classId);
  }

  /**
   * Update class information
   * PATCH /api/services/classes/:id
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'admin')
  @ApiOperation({
    summary: 'Update class information',
    description: 'Update class details like name, dates, or description',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Class updated successfully',
    type: UpdateClassResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Class not found',
  })
  async updateClass(
    @Param('id') classId: string,
    @Body() dto: UpdateClassRequestDto,
  ) {
    await this.classService.updateClass(classId, {
      name: dto.name,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      description: dto.description,
      totalSessions: dto.totalSessions,
    });
    
    // Return full class details after update
    const classEntity = await this.classService.getClassById(classId);
    return {
      id: classEntity.id,
      name: classEntity.name,
      type: classEntity.type,
      status: classEntity.status,
      startDate: classEntity.startDate,
      endDate: classEntity.endDate,
      description: classEntity.description,
      totalSessions: classEntity.totalSessions,
      createdAt: classEntity.createdAt,
      updatedAt: classEntity.updatedAt,
    };
  }

  /**
   * Update class status
   * PATCH /api/services/classes/:id/status
   */
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'admin')
  @ApiOperation({
    summary: 'Update class status',
    description: 'Change class status (DRAFT, ACTIVE, COMPLETED, CANCELLED)',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Class status updated successfully',
    type: ClassStatusResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Class not found',
  })
  async updateClassStatus(
    @Param('id') classId: string,
    @Body() dto: UpdateClassStatusRequestDto,
  ): Promise<ClassStatusResponseDto> {
    return this.classService.updateClassStatus(classId, dto.status);
  }

  /**
   * Add mentor to class
   * POST /api/services/classes/:id/mentors
   */
  @Post(':id/mentors')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'admin')
  @ApiOperation({
    summary: 'Add mentor to class',
    description: 'Add a mentor to the class with price per session',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    type: String,
  })
  @ApiCreatedResponse({
    description: 'Mentor added successfully',
    type: AddMemberResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Class not found',
  })
  async addMentor(
    @Param('id') classId: string,
    @Body() dto: AddMentorRequestDto,
  ): Promise<AddMemberResponseDto> {
    const result = await this.classService.addMentor(classId, {
      mentorUserId: dto.mentorUserId,
      pricePerSession: dto.pricePerSession,
    });
    return {
      ...result,
      mentorId: dto.mentorUserId,
    };
  }

  /**
   * Remove mentor from class
   * DELETE /api/services/classes/:id/mentors/:mentorId
   */
  @Delete(':id/mentors/:mentorId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'admin')
  @ApiOperation({
    summary: 'Remove mentor from class',
    description: 'Remove a mentor from the class',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    type: String,
  })
  @ApiParam({
    name: 'mentorId',
    description: 'Mentor user ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Mentor removed successfully',
    type: RemoveMemberResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Class or mentor not found',
  })
  async removeMentor(
    @Param('id') classId: string,
    @Param('mentorId') mentorId: string,
  ): Promise<RemoveMemberResponseDto> {
    const result = await this.classService.removeMentor(classId, mentorId);
    return {
      ...result,
      mentorId,
    };
  }

  /**
   * Update mentor price
   * PATCH /api/services/classes/:id/mentors/:mentorId/price
   */
  @Patch(':id/mentors/:mentorId/price')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'admin')
  @ApiOperation({
    summary: 'Update mentor price per session',
    description: 'Update the price per session for a specific mentor in the class',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    type: String,
  })
  @ApiParam({
    name: 'mentorId',
    description: 'Mentor user ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Mentor price updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Class or mentor not found',
  })
  async updateMentorPrice(
    @Param('id') classId: string,
    @Param('mentorId') mentorId: string,
    @Body() dto: UpdateMentorPriceRequestDto,
  ) {
    return this.classService.updateMentorPrice(classId, mentorId, dto.pricePerSession);
  }

  /**
   * Add student to class
   * POST /api/services/classes/:id/students
   */
  @Post(':id/students')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'admin')
  @ApiOperation({
    summary: 'Add student to class',
    description: 'Add a student to the class',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    type: String,
  })
  @ApiCreatedResponse({
    description: 'Student added successfully',
    type: AddMemberResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Class not found',
  })
  async addStudent(
    @Param('id') classId: string,
    @Body() dto: AddStudentRequestDto,
  ): Promise<AddMemberResponseDto> {
    const result = await this.classService.addStudent(classId, {
      studentUserId: dto.studentUserId,
    });
    return {
      ...result,
      studentId: dto.studentUserId,
    };
  }

  /**
   * Remove student from class
   * DELETE /api/services/classes/:id/students/:studentId
   */
  @Delete(':id/students/:studentId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'admin')
  @ApiOperation({
    summary: 'Remove student from class',
    description: 'Remove a student from the class',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    type: String,
  })
  @ApiParam({
    name: 'studentId',
    description: 'Student user ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Student removed successfully',
    type: RemoveMemberResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Class or student not found',
  })
  async removeStudent(
    @Param('id') classId: string,
    @Param('studentId') studentId: string,
  ): Promise<RemoveMemberResponseDto> {
    const result = await this.classService.removeStudent(classId, studentId);
    return {
      ...result,
      studentId,
    };
  }

  /**
   * Add counselor to class
   * POST /api/services/classes/:id/counselors
   */
  @Post(':id/counselors')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'admin')
  @ApiOperation({
    summary: 'Add counselor to class',
    description: 'Add a counselor to the class',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    type: String,
  })
  @ApiCreatedResponse({
    description: 'Counselor added successfully',
    type: AddMemberResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Class not found',
  })
  async addCounselor(
    @Param('id') classId: string,
    @Body() dto: AddCounselorRequestDto,
  ): Promise<AddMemberResponseDto> {
    const result = await this.classService.addCounselor(classId, {
      counselorUserId: dto.counselorUserId,
    });
    return {
      ...result,
      counselorId: dto.counselorUserId,
    };
  }

  /**
   * Remove counselor from class
   * DELETE /api/services/classes/:id/counselors/:counselorId
   */
  @Delete(':id/counselors/:counselorId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'admin')
  @ApiOperation({
    summary: 'Remove counselor from class',
    description: 'Remove a counselor from the class',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    type: String,
  })
  @ApiParam({
    name: 'counselorId',
    description: 'Counselor user ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Counselor removed successfully',
    type: RemoveMemberResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Class or counselor not found',
  })
  async removeCounselor(
    @Param('id') classId: string,
    @Param('counselorId') counselorId: string,
  ): Promise<RemoveMemberResponseDto> {
    const result = await this.classService.removeCounselor(classId, counselorId);
    return {
      ...result,
      counselorId,
    };
  }
}

