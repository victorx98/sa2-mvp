import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
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
import { ClassSessionService } from '@application/commands/services/class-session.service';
import { ClassSessionQueryService } from '@application/queries/services/class-session.query.service';
import { ClassQueryService } from '@application/queries/services/class.query.service';

// ============================================================================
// DTOs - Request
// ============================================================================

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateClassSessionRequestDto {
  @ApiProperty({
    description: 'Class ID',
    example: 'class-uuid-123',
  })
  @IsString()
  @IsNotEmpty()
  classId: string;

  @ApiProperty({
    description: 'Mentor ID',
    example: '4903b94b-67cc-42a1-9b3e-91ebc51bcefc',
  })
  @IsString()
  @IsNotEmpty()
  mentorId: string;

  @ApiProperty({
    description: 'Session Title',
    example: 'Week 1 - Career Planning Basics',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Session Description',
    example: 'Introduction to career planning fundamentals',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Scheduled Start Time (ISO 8601)',
    example: '2025-12-03T06:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  scheduledAt: string;

  @ApiProperty({
    description: 'Session Duration in minutes',
    example: 60,
    required: false,
  })
  @IsInt()
  @Min(15)
  @IsOptional()
  @Transform(({ obj }) => obj.duration || 60)
  duration?: number;

  @ApiProperty({
    description: 'Meeting Provider',
    example: 'feishu',
    required: false,
  })
  @IsString()
  @IsOptional()
  meetingProvider?: string;
}

export class UpdateClassSessionRequestDto {
  @ApiProperty({
    description: 'Session Title',
    example: 'Week 1 - Career Planning Basics',
    required: false,
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Session Description',
    example: 'Introduction to career planning fundamentals',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Scheduled Start Time (ISO 8601)',
    example: '2025-12-03T06:00:00Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiProperty({
    description: 'Session Duration in minutes',
    example: 60,
    required: false,
  })
  @IsInt()
  @Min(15)
  @IsOptional()
  duration?: number;
}

export class CancelClassSessionRequestDto {
  @ApiProperty({
    description: 'Cancellation reason',
    example: 'Mentor unavailable',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

// ============================================================================
// DTOs - Response
// ============================================================================

export class CreateClassSessionResponseDto {
  sessionId: string;
  status: string;
  scheduledAt: string;
}

export class UpdateClassSessionResponseDto {
  sessionId: string;
  updated: boolean;
}

export class CancelClassSessionResponseDto {
  sessionId: string;
  status: string;
}

export class DeleteClassSessionResponseDto {
  sessionId: string;
  status: string;
}

// ============================================================================
// Controller
// ============================================================================

/**
 * API Layer - Class Session Management Controller
 *
 * Responsibility:
 * - Define HTTP routes for class session management
 * - Extract and validate request parameters
 * - Call Application Layer services
 * - Return HTTP responses
 *
 * Route: /api/services/class-sessions
 */
@ApiTags('Services - Class Session Management')
@Controller(`${ApiPrefix}/services/class-sessions`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ClassSessionController {
  constructor(
    private readonly classSessionService: ClassSessionService,
    private readonly classSessionQueryService: ClassSessionQueryService,
    private readonly classQueryService: ClassQueryService,
  ) {}

  /**
   * Helper method: Check if current user is a counselor of the class
   * Admin users bypass this check
   */
  private async checkClassCounselorPermission(classId: string, user: User): Promise<void> {
    // Admin users can access all classes
    if (user.roles?.includes('admin')) {
      return;
    }

    // Check if user is a counselor of this class
    const counselors = await this.classQueryService.getClassCounselorsWithNames(classId);
    const isCounselor = counselors.some(c => c.userId === user.id);

    if (!isCounselor) {
      throw new ForbiddenException('Only counselors of this class can perform this action');
    }
  }

  /**
   * Create a new class session
   * POST /api/services/class-sessions
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'admin')
  @ApiOperation({
    summary: 'Create a new class session',
    description: `
      Create a new class session for multiple students.
      
      Sync Flow (returns immediately):
      1. Create calendar slot for mentor
      2. Create session record with PENDING_MEETING status
      3. Return response with sessionId and status
      
      Async Flow (runs in background):
      1. Create meeting link via third-party API
      2. Update session with meeting_id and status=SCHEDULED
      3. Publish CLASS_SESSION_CREATED_EVENT
      
      Client should poll GET /api/services/class-sessions/:id to check status and get meetingUrl
    `,
  })
  @ApiCreatedResponse({
    description: 'Class session created successfully',
    type: CreateClassSessionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 404,
    description: 'Class not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Time conflict (mentor already scheduled)',
  })
  async createSession(
    @CurrentUser() user: User,
    @Body() dto: CreateClassSessionRequestDto,
  ): Promise<CreateClassSessionResponseDto> {
    // Check if current user is a counselor of this class (admin bypass)
    await this.checkClassCounselorPermission(dto.classId, user);

    const result = await this.classSessionService.createSession({
      classId: dto.classId,
      mentorId: dto.mentorId,
      title: dto.title,
      description: dto.description,
      scheduledAt: new Date(dto.scheduledAt),
      duration: dto.duration,
      meetingProvider: dto.meetingProvider,
      createdByCounselorId: user.id, // Set current user as creator
    });

    return {
      sessionId: result.sessionId,
      status: result.status,
      scheduledAt: result.scheduledAt,
    };
  }

  /**
   * Get list of class sessions
   * GET /api/services/class-sessions
   */
  @Get()
  @ApiOperation({
    summary: 'Get list of class sessions',
    description: `
      Retrieve class sessions with optional filtering.
      
      Query Parameters:
      - classId (optional): Filter by specific class ID
      - mentorId (optional): Filter by specific mentor ID
      - status (optional): Filter by session status
      - startDate (optional): Filter by start date
      - endDate (optional): Filter by end date
    `,
  })
  @ApiOkResponse({
    description: 'Class sessions retrieved successfully',
  })
  async getSessionsList(
    @CurrentUser() user: User,
    @Query('classId') classId?: string,
    @Query('mentorId') mentorId?: string,
    @Query('status') status?: string,
    @Query() filters?: any,
  ) {
    if (classId) {
      return this.classSessionQueryService.getSessionsByClass(classId, { status: status as any });
    }
    if (mentorId) {
      return this.classSessionQueryService.getMentorSessions(mentorId, { status: status as any });
    }
    // TODO: Implement other filter options
    return [];
  }

  /**
   * Get class session details
   * GET /api/services/class-sessions/:id
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get class session details',
    description: 'Retrieve detailed information about a specific class session',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Class session retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async getSessionDetail(
    @Param('id') sessionId: string,
  ) {
    return this.classSessionQueryService.getSessionById(sessionId);
  }

  /**
   * Update class session
   * PATCH /api/services/class-sessions/:id
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'admin')
  @ApiOperation({
    summary: 'Update class session',
    description: 'Update session details like title, description, or scheduled time',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Class session updated successfully',
    type: UpdateClassSessionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Time conflict detected',
  })
  async updateSession(
    @CurrentUser() user: User,
    @Param('id') sessionId: string,
    @Body() dto: UpdateClassSessionRequestDto,
  ) {
    // Get session to find classId
    const session = await this.classSessionQueryService.getSessionById(sessionId);
    
    // Check if current user is a counselor of this class (admin bypass)
    await this.checkClassCounselorPermission(session.classId, user);

    return this.classSessionService.updateSession(sessionId, {
      title: dto.title,
      description: dto.description,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      duration: dto.duration,
    });
  }

  /**
   * Cancel class session
   * POST /api/services/class-sessions/:id/cancel
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'admin')
  @ApiOperation({
    summary: 'Cancel class session',
    description: `
      Cancel an existing class session with optional reason.
      
      Sync Flow (immediate response):
      - Update session status to CANCELLED
      - Release calendar slots
      - Return cancelled session details
      
      Async Flow (background):
      - Cancel meeting via third-party API (max 3 retries)
      - Update meetings table
      - Send notifications
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Class session cancelled successfully',
    type: CancelClassSessionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid session status',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async cancelSession(
    @CurrentUser() user: User,
    @Param('id') sessionId: string,
    @Body() dto: CancelClassSessionRequestDto,
  ): Promise<CancelClassSessionResponseDto> {
    // Get session to find classId
    const session = await this.classSessionQueryService.getSessionById(sessionId);
    
    // Check if current user is a counselor of this class (admin bypass)
    await this.checkClassCounselorPermission(session.classId, user);

    return this.classSessionService.cancelSession(
      sessionId,
      dto.reason || 'Cancelled by administrator',
    );
  }

  /**
   * Delete class session
   * DELETE /api/services/class-sessions/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'admin')
  @ApiOperation({
    summary: 'Delete class session',
    description: 'Soft delete a class session (marks as deleted)',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Class session deleted successfully',
    type: DeleteClassSessionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async deleteSession(
    @CurrentUser() user: User,
    @Param('id') sessionId: string,
  ): Promise<DeleteClassSessionResponseDto> {
    // Get session to find classId
    const session = await this.classSessionQueryService.getSessionById(sessionId);
    
    // Check if current user is a counselor of this class (admin bypass)
    await this.checkClassCounselorPermission(session.classId, user);

    return this.classSessionService.deleteSession(sessionId);
  }
}

