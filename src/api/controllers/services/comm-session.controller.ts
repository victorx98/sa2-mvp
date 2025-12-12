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
import { CommSessionService } from '@application/commands/services/comm-session.service';
import { CommSessionMapper } from '@domains/services/comm-sessions/mappers/comm-session.mapper';
import { plainToInstance } from 'class-transformer';

// ============================================================================
// DTOs - Request
// ============================================================================

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCommSessionRequestDto {
  @ApiProperty({
    description: 'Student ID',
    example: '9e50af7d-5f08-4516-939f-7f765ce131b8',
  })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({
    description: 'Mentor/Tutor ID (Optional)',
    example: '4903b94b-67cc-42a1-9b3e-91ebc51bcefc',
    required: false,
  })
  @IsString()
  @IsOptional()
  mentorId?: string;

  @ApiProperty({
    description: 'Session Title',
    example: 'Discussion about career',
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

export class UpdateCommSessionRequestDto {
  @ApiProperty({
    description: 'Session Title',
    example: 'Discussion about career',
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

export class CommSessionResponseDto {
  id: string;
  meetingId: string;
  sessionType: string;
  studentUserId: string;
  studentName?: { en: string; zh: string };
  mentorUserId?: string;
  mentorName?: { en: string; zh: string };
  counselorUserId?: string;
  counselorName?: { en: string; zh: string };
  createdByCounselorId: string;
  createdByCounselorName?: { en: string; zh: string };
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
  meeting?: MeetingDto;
}

export class CreateSessionResponseDto {
  sessionId: string;
  status: string;
  scheduledAt: string;
}

// ============================================================================
// Controller
// ============================================================================

/**
 * API Layer - Counselor Communication Session Controller
 *
 * Responsibility:
 * - Define HTTP routes for communication session management
 * - Extract and validate request parameters
 * - Call Application Layer services
 * - Return HTTP responses
 *
 * Route: /api/services/comm-session
 */
@ApiTags('Counselor Portal - Communication Session')
@Controller(`${ApiPrefix}/services/comm-session`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CommSessionController {
  constructor(
    private readonly commSessionService: CommSessionService,
  ) {}

  /**
   * Create a new communication session
   * POST /api/services/comm-session
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
    summary: 'Create a new communication session',
    description: `
      Creates a new communication session asynchronously.
      
      Sync Flow:
      1. Create calendar slots for student and mentor/counselor
      2. Create session record with PENDING_MEETING status
      3. Return response with sessionId and status
      
      Async Flow:
      1. Create meeting link via third-party API
      2. Update session with meeting_id and status=SCHEDULED
      3. Publish SESSION_BOOKED_EVENT
    `,
  })
  @ApiCreatedResponse({
    description: 'Session created successfully',
    type: CreateSessionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 409,
    description: 'Time conflict (student or mentor already scheduled)',
  })
  async createSession(
    @CurrentUser() user: User,
    @Body() dto: CreateCommSessionRequestDto,
  ): Promise<CreateSessionResponseDto> {
    const result = await this.commSessionService.createSession({
      counselorId: user.id,
      studentId: dto.studentId,
      mentorId: dto.mentorId,
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
   * Get list of communication sessions with flexible filtering
   * GET /api/services/comm-session
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
   * @param filters Additional query filters
   * @returns List of sessions
   */
  @Get()
  @ApiOperation({
    summary: 'Get list of communication sessions with flexible filtering',
    description: `
      Retrieve communication sessions with support for multiple query combinations:
      
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
      - GET /api/services/comm-session (returns user's own sessions)
      - GET /api/services/comm-session?studentId=xxx (returns student's sessions)
      - GET /api/services/comm-session?mentorId=xxx (returns mentor's sessions)
      - GET /api/services/comm-session?mentorId=xxx&studentId=yyy (returns sessions for specific mentor-student pair)
    `,
  })
  @ApiOkResponse({
    description: 'Sessions retrieved successfully',
    type: CommSessionResponseDto,
    isArray: true,
  })
  async getSessionsList(
    @CurrentUser() user: User,
    @Query('studentId') studentId?: string,
    @Query('mentorId') mentorId?: string,
    @Query('counselorId') counselorId?: string,
    @Query() filters?: any,
  ): Promise<CommSessionResponseDto[]> {
    const userRole = user.roles?.[0] || 'student';
    
    // Build filter object with all ID parameters
    const sessionFilters = {
      ...filters,
      studentId,
      mentorId,
      counselorId,
    };
    
    // Fetch sessions with meeting data
    const sessions = await this.commSessionService.getSessionsByRole(
      user.id,
      userRole,
      sessionFilters,
    );
    
    // Map sessions with meeting information to response DTO
    return CommSessionMapper.toResponseDtos(sessions || []);
  }

  /**
   * Get communication session details
   * GET /api/services/comm-session/:id
   *
   * @param sessionId Session ID
   * @returns Session details
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @ApiOperation({
    summary: 'Get communication session details',
    description: 'Retrieve detailed information about a specific communication session',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Session retrieved successfully',
    type: CommSessionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async getSessionDetail(
    @Param('id') sessionId: string,
  ): Promise<CommSessionResponseDto> {
    const session = await this.commSessionService.getSessionById(sessionId);
    return CommSessionMapper.toResponseDto(session);
  }

  /**
   * Update a communication session
   * PATCH /api/services/comm-session/:id
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
    summary: 'Update a communication session',
    description: 'Update session details like title, description, or scheduled time',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Session updated successfully',
    type: CommSessionResponseDto,
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
    @Body() dto: UpdateCommSessionRequestDto,
  ): Promise<CommSessionResponseDto> {
    const updatedSession = await this.commSessionService.updateSession(
      sessionId,
      {
        title: dto.title,
        description: dto.description,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        duration: dto.duration,
      },
    );
    return CommSessionMapper.toResponseDto(updatedSession);
  }

  /**
   * Cancel a communication session
   * POST /api/services/comm-session/:id/cancel
   *
   * Sync Flow (returns immediately):
   * 1. Update session status to CANCELLED
   * 2. Release calendar slots (update to cancelled)
   * 3. Return response with CANCELLED status
   *
   * Async Flow (runs in background):
   * 1. Cancel meeting via third-party API (Feishu/Zoom) with retry (max 3 times)
   * 2. Update meetings table status to CANCELLED
   * 3. Publish success/failed event for notifications:
   *    - Success: Notify counselor + mentor + student
   *    - Failed: Notify counselor only (requires manual retry from frontend)
   *
   * @param sessionId Session ID
   * @param body Cancel request with reason
   * @returns Cancelled session details
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @ApiOperation({
    summary: 'Cancel a communication session',
    description: `
      Cancel an existing communication session with optional reason.
      
      Sync Flow (immediate response):
      - Update session status to CANCELLED
      - Release calendar slots
      - Return cancelled session details
      
      Async Flow (background):
      - Cancel meeting via third-party API (max 3 retries)
      - Update meetings table
      - Send notifications based on result (success: all parties, failed: counselor only)
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Session cancelled successfully (meeting cancellation in progress)',
    type: CommSessionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid session status (only SCHEDULED/PENDING_MEETING can be cancelled)',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async cancelSession(
    @Param('id') sessionId: string,
    @Body() body?: { reason?: string },
  ): Promise<CommSessionResponseDto> {
    const cancelledSession = await this.commSessionService.cancelSession(
      sessionId,
      body?.reason || 'Cancelled by counselor',
    );
    
    // Return cancelled session with meeting info
    return CommSessionMapper.toResponseDto(cancelledSession);
  }

  /**
   * Delete (soft delete) a communication session
   * DELETE /api/services/comm-session/:id
   *
   * @param sessionId Session ID
   * @returns Deletion result
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @ApiOperation({
    summary: 'Delete a communication session',
    description: 'Soft delete a communication session (marks as deleted)',
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
    return this.commSessionService.deleteSession(sessionId);
  }
}

