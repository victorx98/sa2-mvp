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
import { RegularMentoringService } from '@application/commands/services/regular-mentoring.service';
import { RegularMentoringSessionMapper } from '@domains/services/sessions/regular-mentoring/mappers/regular-mentoring-session.mapper';
import { plainToInstance } from 'class-transformer';

// ============================================================================
// DTOs - Request
// ============================================================================

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsInt, Min, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateRegularMentoringRequestDto {
  @ApiProperty({
    description: 'Student ID',
    example: '9e50af7d-5f08-4516-939f-7f765ce131b8',
  })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({
    description: 'Mentor/Tutor ID',
    example: '4903b94b-67cc-42a1-9b3e-91ebc51bcefc',
  })
  @IsString()
  @IsNotEmpty()
  mentorId: string;

  @ApiProperty({
    description: 'Session Type ID',
    example: 'uuid-session-type-id',
  })
  @IsString()
  @IsNotEmpty()
  sessionTypeId: string;

  @ApiProperty({
    description: 'Session Title',
    example: 'Resume Coaching',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Session Description',
    example: 'Session description',
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

export class UpdateRegularMentoringRequestDto {
  @ApiProperty({
    description: 'Session Title',
    example: 'Resume Coaching',
    required: false,
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Session Description',
    example: 'Session description',
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
  @IsString()
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

// ============================================================================
// DTOs - Response
// ============================================================================

// Meeting DTO
export class MeetingDto {
  id: string;
  meetingNo: string;
  meetingProvider: string;
  meetingId: string;
  topic: string;
  meetingUrl: string;
  ownerId: string;
  scheduleStartTime: string;
  scheduleDuration: number;
  status: string;
  actualDuration?: number;
  meetingTimeList?: any[];
  recordingUrl?: string;
  lastMeetingEndedTimestamp?: string;
  pendingTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

export class RegularMentoringSessionResponseDto {
  id: string;
  meetingId: string;
  sessionType: string;
  sessionTypeId: string;
  studentUserId: string;
  mentorUserId: string;
  createdByCounselorId: string;
  title: string;
  description?: string;
  status: string;
  scheduledAt: string;
  completedAt?: string;
  cancelledAt?: string;
  deletedAt?: string;
  aiSummaries?: any[];
  createdAt: string;
  updatedAt: string;
  meeting: MeetingDto;
}

export class CreateSessionResponseDto {
  sessionId: string;
  status: string; // PENDING_MEETING during async flow, SCHEDULED after meeting creation
  scheduledAt: string;
  // Meeting details are filled asynchronously - client should poll GET /api/services/regular-mentoring/:id
  // meetingId?: string;
  // meetingNo?: string;
  // meetingUrl?: string;
  holdId?: string;
}

// ============================================================================
// Controller
// ============================================================================

/**
 * API Layer - Counselor Regular Mentoring Controller
 *
 * Responsibility:
 * - Define HTTP routes for regular mentoring session management
 * - Extract and validate request parameters
 * - Call Application Layer services
 * - Return HTTP responses
 *
 * Route: /api/services/regular-mentoring
 */
@ApiTags('Counselor Portal - Regular Mentoring')
@Controller(`${ApiPrefix}/services/regular-mentoring`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RegularMentoringController {
  constructor(
    private readonly regularMentoringService: RegularMentoringService,
  ) {}

  /**
   * Create a new regular mentoring session
   * POST /api/services/regular-mentoring
   *
   * @param user Current counselor user
   * @param dto Create session request
   * @returns Created session details
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @ApiOperation({
    summary: 'Create a new regular mentoring session',
    description: `
      Creates a new regular mentoring session asynchronously.
      
      Sync Flow (returns immediately):
      1. Create calendar slots for mentor and student
      2. Create session record with PENDING_MEETING status
      3. Return response with sessionId and status
      
      Async Flow (runs in background):
      1. Create meeting link via third-party API
      2. Update session with meeting_id and status=SCHEDULED
      3. Publish SESSION_BOOKED_EVENT
      
      Response includes:
      - sessionId: unique session identifier
      - status: PENDING_MEETING (meeting creation in progress)
      - scheduledAt: scheduled start time
      
      Client should poll GET /api/services/regular-mentoring/:id to check status and get meetingUrl
    `,
  })
  @ApiCreatedResponse({
    description: 'Session created successfully',
    type: CreateSessionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters or insufficient balance',
  })
  @ApiResponse({
    status: 403,
    description: 'Not authorized to book for this student',
  })
  @ApiResponse({
    status: 409,
    description: 'Time conflict (mentor or student already scheduled)',
  })
  async createSession(
    @CurrentUser() user: User,
    @Body() dto: CreateRegularMentoringRequestDto,
  ): Promise<CreateSessionResponseDto> {
    const result = await this.regularMentoringService.createSession({
      counselorId: user.id,
      studentId: dto.studentId,
      mentorId: dto.mentorId,
      sessionTypeId: dto.sessionTypeId,
      title: dto.title,
      description: dto.description,
      scheduledAt: new Date(dto.scheduledAt),
      duration: dto.duration,
      meetingProvider: dto.meetingProvider,
    });

    // Convert scheduledAt back to ISO string for response
    return {
      ...result,
      scheduledAt: typeof result.scheduledAt === 'string' 
        ? result.scheduledAt 
        : result.scheduledAt.toISOString(),
    };
  }

  /**
   * Get list of regular mentoring sessions with flexible filtering
   * GET /api/services/regular-mentoring
   *
   * Supports multiple query scenarios:
   * - Without parameters: Returns sessions based on user role (default behavior)
   * - With studentId: Returns that student's sessions
   * - With mentorId: Returns that mentor's sessions
   * - With both studentId & mentorId: Returns sessions for that student-mentor pair
   * - With counselorId: Returns sessions for that counselor's students (counselor role only)
   *
   * @param user Current user from JWT token
   * @param studentId Optional student ID filter
   * @param mentorId Optional mentor ID filter
   * @param counselorId Optional counselor ID filter
   * @param filters Additional query filters (status, dates, pagination, etc.)
   * @returns List of sessions matching the query criteria
   */
  @Get()
  @ApiOperation({
    summary: 'Get list of regular mentoring sessions with flexible filtering',
    description: `
      Retrieve regular mentoring sessions with support for multiple query combinations:
      
      Query Parameters:
      - studentId (optional): Filter by specific student ID
      - mentorId (optional): Filter by specific mentor ID
      - counselorId (optional): Filter by specific counselor ID (counselor role only)
      - status (optional): Filter by session status (SCHEDULED, COMPLETED, CANCELLED, etc.)
      - startDate (optional): Filter by start date
      - endDate (optional): Filter by end date
      - page (optional): Pagination page number
      - limit (optional): Results per page
      
      Examples:
      - GET /api/services/regular-mentoring (returns user's own sessions)
      - GET /api/services/regular-mentoring?studentId=xxx (returns student's sessions)
      - GET /api/services/regular-mentoring?mentorId=xxx (returns mentor's sessions)
      - GET /api/services/regular-mentoring?mentorId=xxx&studentId=yyy (returns sessions for specific mentor-student pair)
    `,
  })
  @ApiOkResponse({
    description: 'Sessions retrieved successfully',
    type: RegularMentoringSessionResponseDto,
    isArray: true,
  })
  async getSessionsList(
    @CurrentUser() user: User,
    @Query('studentId') studentId?: string,
    @Query('mentorId') mentorId?: string,
    @Query('counselorId') counselorId?: string,
    @Query() filters?: any,
  ): Promise<RegularMentoringSessionResponseDto[]> {
    const userRole = user.roles?.[0] || 'student';
    
    // Build filter object with all ID parameters
    const sessionFilters = {
      ...filters,
      studentId,
      mentorId,
      counselorId,
    };
    
    // Fetch sessions with meeting data
    const sessions = await this.regularMentoringService.getSessionsByRole(
      user.id,
      userRole,
      sessionFilters,
    );
    
    // Map sessions with meeting information to response DTO
    return RegularMentoringSessionMapper.toResponseDtos(sessions || []);
  }

  /**
   * Get regular mentoring session details
   * GET /api/services/regular-mentoring/:id
   *
   * @param sessionId Session ID
   * @returns Session details
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @ApiOperation({
    summary: 'Get regular mentoring session details',
    description: 'Retrieve detailed information about a specific regular mentoring session',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Session retrieved successfully',
    type: RegularMentoringSessionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async getSessionDetail(
    @Param('id') sessionId: string,
  ): Promise<RegularMentoringSessionResponseDto> {
    const session = await this.regularMentoringService.getSessionById(sessionId);
    // Map session with meeting information to response DTO
    return RegularMentoringSessionMapper.toResponseDto(session);
  }

  /**
   * Update a regular mentoring session
   * PATCH /api/services/regular-mentoring/:id
   *
   * @param sessionId Session ID
   * @param dto Update request
   * @returns Updated session
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @ApiOperation({
    summary: 'Update a regular mentoring session',
    description: 'Update session details like title, description, or scheduled time',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Session updated successfully',
    type: RegularMentoringSessionResponseDto,
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
    @Param('id') sessionId: string,
    @Body() dto: UpdateRegularMentoringRequestDto,
  ): Promise<RegularMentoringSessionResponseDto> {
    const updatedSession = await this.regularMentoringService.updateSession(
      sessionId,
      {
        title: dto.title,
        description: dto.description,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        duration: dto.duration,
      },
    );
    // Use mapper to ensure all fields including meeting info are properly mapped
    return RegularMentoringSessionMapper.toResponseDto(updatedSession);
  }

  /**
   * Cancel a regular mentoring session
   * POST /api/services/regular-mentoring/:id/cancel
   *
   * @param sessionId Session ID
   * @param body Cancel request with reason
   * @returns Cancellation result
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @ApiOperation({
    summary: 'Cancel a regular mentoring session',
    description: 'Cancel an existing regular mentoring session with an optional reason',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Session cancelled successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async cancelSession(
    @Param('id') sessionId: string,
    @Body() body?: { reason?: string },
  ) {
    return this.regularMentoringService.cancelSession(
      sessionId,
      body?.reason || 'Cancelled by counselor',
    );
  }

  /**
   * Delete (soft delete) a regular mentoring session
   * DELETE /api/services/regular-mentoring/:id
   *
   * @param sessionId Session ID
   * @returns Deletion result
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @ApiOperation({
    summary: 'Delete a regular mentoring session',
    description: 'Soft delete a regular mentoring session (marks as deleted)',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Session deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async deleteSession(
    @Param('id') sessionId: string,
  ) {
    return this.regularMentoringService.deleteSession(sessionId);
  }
}

