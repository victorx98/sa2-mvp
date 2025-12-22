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
import { SessionType } from '@domains/services/sessions/shared/enums/session-type.enum';
import {
  CreateSessionRequestDto,
  UpdateSessionRequestDto,
  CancelSessionRequestDto,
  DeleteSessionRequestDto,
} from '@api/dto/request/services/sessions';
import {
  SessionResponseDto,
  CreateSessionResponseDto,
} from '@api/dto/response/services/sessions';

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
        serviceType: dto.serviceType, // Pass serviceType from frontend
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
    description: 'Update session details like title, description, or scheduled time. Requires sessionType in request body.',
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
    @Body() dto: UpdateSessionRequestDto,
  ): Promise<SessionResponseDto> {
    const updatedSession = await this.sessionOrchestratorService.updateSession(
      dto.sessionType,
      sessionId,
      {
        title: dto.title,
        description: dto.description,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        duration: dto.duration,
      },
    );

    return this.mapSessionToResponse(dto.sessionType, updatedSession);
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
      Cancel an existing session with optional description. Requires sessionType in request body.
      
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
    @Body() dto: CancelSessionRequestDto,
  ): Promise<SessionResponseDto> {
    const cancelledSession = await this.sessionOrchestratorService.cancelSession(
      dto.sessionType,
      sessionId,
      dto.description || 'Cancelled by counselor',
    );

    return this.mapSessionToResponse(dto.sessionType, cancelledSession);
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
    description: 'Soft delete a session (marks as deleted). Requires sessionType in request body.',
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
    @Body() dto: DeleteSessionRequestDto,
  ) {
    return this.sessionOrchestratorService.deleteSession(dto.sessionType, sessionId);
  }

  /**
   * Helper: Map single session to response using appropriate mapper
   */
  private mapSessionToResponse(sessionType: string, session: any): SessionResponseDto {
    // Directly return the session data, no special mapping needed
    return session as SessionResponseDto;
  }

  /**
   * Helper: Map sessions array to response using appropriate mapper
   */
  private mapSessionsToResponse(sessionType: string, sessions: any[]): SessionResponseDto[] {
    // Directly return the sessions data, no special mapping needed
    return sessions as SessionResponseDto[];
  }
}

