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
  ApiProperty,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { User } from '@domains/identity/user/user-interface';
import { ApiPrefix } from '@api/api.constants';
import { SessionOrchestratorService } from '@application/commands/services/session-orchestrator.service';
import { RegularMentoringSessionMapper } from '@domains/services/sessions/regular-mentoring/mappers/regular-mentoring-session.mapper';
import { GapAnalysisSessionMapper } from '@domains/services/sessions/gap-analysis/mappers/gap-analysis-session.mapper';
import { AiCareerSessionMapper } from '@domains/services/sessions/ai-career/mappers/ai-career-session.mapper';
import { SessionType } from '@domains/services/sessions/shared/enums/session-type.enum';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsDateString, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

// ============================================================================
// DTOs - Request
// ============================================================================

export class CreateSessionRequestDto {
  @ApiProperty({
    description: 'Session Type',
    example: 'regular_mentoring',
    enum: ['regular_mentoring', 'gap_analysis', 'ai_career'],
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(SessionType, {
    message: 'sessionType must be one of: regular_mentoring, gap_analysis, ai_career',
  })
  sessionType: string;

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

export class UpdateSessionRequestDto {
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

export class SessionResponseDto {
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
  status: string;
  scheduledAt: string;
  holdId?: string;
}

// ============================================================================
// Controller
// ============================================================================

/**
 * Unified Session Controller
 * 
 * Purpose: Provides unified API endpoints for all session types
 * Routes requests to SessionOrchestratorService which delegates to specific services
 * 
 * Route: /api/services/sessions
 * 
 * Supported Session Types:
 * - regular_mentoring
 * - gap_analysis
 * - ai_career
 */
@ApiTags('Counselor Portal - Unified Sessions')
@Controller(`${ApiPrefix}/services/sessions`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SessionController {
  constructor(
    private readonly sessionOrchestratorService: SessionOrchestratorService,
  ) {}

  /**
   * Create a new session (any type)
   * POST /api/services/sessions
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @ApiOperation({
    summary: 'Create a new session (unified endpoint)',
    description: `
      Creates a new session asynchronously. Supports multiple session types:
      - regular_mentoring: Regular mentoring sessions
      - gap_analysis: Gap analysis sessions
      - ai_career: AI career assessment sessions
      
      Sync Flow (returns immediately):
      1. Create calendar slots for mentor and student
      2. Create session record with PENDING_MEETING status
      3. Return response with sessionId and status
      
      Async Flow (runs in background):
      1. Create meeting link via third-party API
      2. Update session with meeting_id and status=SCHEDULED
      3. Publish SESSION_BOOKED_EVENT
      
      Client should poll GET /api/services/sessions/:id?sessionType=xxx to check status and get meetingUrl
    `,
  })
  @ApiCreatedResponse({
    description: 'Session created successfully',
    type: CreateSessionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters or unsupported session type',
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
    @Body() dto: CreateSessionRequestDto,
  ): Promise<CreateSessionResponseDto> {
    const result = await this.sessionOrchestratorService.createSession(
      dto.sessionType,
      {
        counselorId: user.id,
        studentId: dto.studentId,
        mentorId: dto.mentorId,
        sessionTypeId: dto.sessionTypeId,
        title: dto.title,
        description: dto.description,
        scheduledAt: new Date(dto.scheduledAt),
        duration: dto.duration,
        meetingProvider: dto.meetingProvider,
      },
    );

    return {
      ...result,
      scheduledAt: typeof result.scheduledAt === 'string'
        ? result.scheduledAt
        : result.scheduledAt.toISOString(),
    };
  }

  /**
   * Get list of sessions with flexible filtering
   * GET /api/services/sessions
   */
  @Get()
  @ApiOperation({
    summary: 'Get list of sessions with flexible filtering (unified endpoint)',
    description: `
      Retrieve sessions with support for multiple query combinations:
      
      Query Parameters:
      - sessionType (optional): Filter by session type, supports single or multiple values
        * Not provided: returns all session types
        * Single: ?sessionType=regular_mentoring
        * Multiple: ?sessionType=regular_mentoring&sessionType=gap_analysis
      - studentId (optional): Filter by specific student ID
      - mentorId (optional): Filter by specific mentor ID
      - counselorId (optional): Filter by specific counselor ID (counselor role only)
      - status (optional): Filter by session status (SCHEDULED, COMPLETED, CANCELLED, etc.)
      - startDate (optional): Filter by start date
      - endDate (optional): Filter by end date
      - page (optional): Pagination page number
      - limit (optional): Results per page
      
      Examples:
      - GET /api/services/sessions (returns all types)
      - GET /api/services/sessions?sessionType=regular_mentoring
      - GET /api/services/sessions?sessionType=gap_analysis&studentId=xxx
      - GET /api/services/sessions?sessionType=regular_mentoring&sessionType=gap_analysis
      - GET /api/services/sessions?sessionType=ai_career&mentorId=xxx&studentId=yyy
    `,
  })
  @ApiOkResponse({
    description: 'Sessions retrieved successfully',
    type: SessionResponseDto,
    isArray: true,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing or invalid sessionType parameter',
  })
  async getSessionsList(
    @CurrentUser() user: User,
    @Query('sessionType') sessionType?: string | string[],
    @Query('studentId') studentId?: string,
    @Query('mentorId') mentorId?: string,
    @Query('counselorId') counselorId?: string,
    @Query() filters?: any,
  ): Promise<SessionResponseDto[]> {
    // If sessionType is not provided, query all types
    const types = sessionType 
      ? (Array.isArray(sessionType) ? sessionType : [sessionType])
      : [SessionType.REGULAR_MENTORING, SessionType.GAP_ANALYSIS, SessionType.AI_CAREER];

    const userRole = user.roles?.[0] || 'student';

    const sessionFilters = {
      ...filters,
      studentId,
      mentorId,
      counselorId,
    };

    // Fetch sessions for all types in parallel
    const results = await Promise.all(
      types.map(type =>
        this.sessionOrchestratorService.getSessionsByRole(
          type,
          user.id,
          userRole,
          sessionFilters,
        ),
      ),
    );

    // Flatten and merge all results
    const allSessions = results.flat();

    // Sort by scheduledAt descending (most recent first)
    allSessions.sort((a, b) => {
      const dateA = new Date(a.scheduledAt).getTime();
      const dateB = new Date(b.scheduledAt).getTime();
      return dateB - dateA;
    });

    // Map each session using its corresponding mapper
    return allSessions.map(session =>
      this.mapSessionToResponse(session.sessionType, session),
    );
  }

  /**
   * Get session details
   * GET /api/services/sessions/:id
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @ApiOperation({
    summary: 'Get session details (unified endpoint)',
    description: 'Retrieve detailed information about a specific session. Requires sessionType query parameter.',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Session retrieved successfully',
    type: SessionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing or invalid sessionType parameter',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async getSessionDetail(
    @Param('id') sessionId: string,
    @Query('sessionType') sessionType: string,
  ): Promise<SessionResponseDto> {
    if (!sessionType) {
      throw new Error('sessionType query parameter is required');
    }

    const session = await this.sessionOrchestratorService.getSessionById(
      sessionType,
      sessionId,
    );

    return this.mapSessionToResponse(sessionType, session);
  }

  /**
   * Update a session
   * PATCH /api/services/sessions/:id
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @ApiOperation({
    summary: 'Update a session (unified endpoint)',
    description: 'Update session details like title, description, or scheduled time. Requires sessionType query parameter.',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Session updated successfully',
    type: SessionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing or invalid sessionType parameter',
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
    @Query('sessionType') sessionType: string,
    @Body() dto: UpdateSessionRequestDto,
  ): Promise<SessionResponseDto> {
    if (!sessionType) {
      throw new Error('sessionType query parameter is required');
    }

    const updatedSession = await this.sessionOrchestratorService.updateSession(
      sessionType,
      sessionId,
      {
        title: dto.title,
        description: dto.description,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        duration: dto.duration,
      },
    );

    return this.mapSessionToResponse(sessionType, updatedSession);
  }

  /**
   * Cancel a session
   * POST /api/services/sessions/:id/cancel
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @ApiOperation({
    summary: 'Cancel a session (unified endpoint)',
    description: `
      Cancel an existing session with optional reason. Requires sessionType query parameter.
      
      Sync Flow (immediate response):
      - Update session status to CANCELLED
      - Release calendar slots
      - Return cancelled session details
      
      Async Flow (background):
      - Cancel meeting via third-party API (max 3 retries)
      - Update meetings table
      - Send notifications based on result
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Session cancelled successfully',
    type: SessionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid session status or missing sessionType parameter',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async cancelSession(
    @Param('id') sessionId: string,
    @Query('sessionType') sessionType: string,
    @Body() body?: { reason?: string },
  ): Promise<SessionResponseDto> {
    if (!sessionType) {
      throw new Error('sessionType query parameter is required');
    }

    const cancelledSession = await this.sessionOrchestratorService.cancelSession(
      sessionType,
      sessionId,
      body?.reason || 'Cancelled by counselor',
    );

    return this.mapSessionToResponse(sessionType, cancelledSession);
  }

  /**
   * Delete (soft delete) a session
   * DELETE /api/services/sessions/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @ApiOperation({
    summary: 'Delete a session (unified endpoint)',
    description: 'Soft delete a session (marks as deleted). Requires sessionType query parameter.',
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
    status: 400,
    description: 'Missing or invalid sessionType parameter',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async deleteSession(
    @Param('id') sessionId: string,
    @Query('sessionType') sessionType: string,
  ) {
    if (!sessionType) {
      throw new Error('sessionType query parameter is required');
    }

    return this.sessionOrchestratorService.deleteSession(sessionType, sessionId);
  }

  /**
   * Helper: Map single session to response using appropriate mapper
   */
  private mapSessionToResponse(sessionType: string, session: any): SessionResponseDto {
    const mappers: Record<string, any> = {
      [SessionType.REGULAR_MENTORING]: RegularMentoringSessionMapper,
      [SessionType.GAP_ANALYSIS]: GapAnalysisSessionMapper,
      [SessionType.AI_CAREER]: AiCareerSessionMapper,
    };

    const mapper = mappers[sessionType];
    if (!mapper) {
      throw new Error(`No mapper found for session type: ${sessionType}`);
    }

    return mapper.toResponseDto(session);
  }

  /**
   * Helper: Map sessions array to response using appropriate mapper
   */
  private mapSessionsToResponse(sessionType: string, sessions: any[]): SessionResponseDto[] {
    const mappers: Record<string, any> = {
      [SessionType.REGULAR_MENTORING]: RegularMentoringSessionMapper,
      [SessionType.GAP_ANALYSIS]: GapAnalysisSessionMapper,
      [SessionType.AI_CAREER]: AiCareerSessionMapper,
    };

    const mapper = mappers[sessionType];
    if (!mapper) {
      throw new Error(`No mapper found for session type: ${sessionType}`);
    }

    return mapper.toResponseDtos(sessions);
  }
}

