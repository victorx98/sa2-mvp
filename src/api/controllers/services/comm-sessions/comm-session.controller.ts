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
import {
  CreateCommSessionRequestDto,
  UpdateCommSessionRequestDto,
} from '@api/dto/request/services/comm-sessions';
import {
  CommSessionResponseDto,
  CreateCommSessionResponseDto,
} from '@api/dto/response/services/comm-sessions';

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
    type: CreateCommSessionResponseDto,
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
  ): Promise<CreateCommSessionResponseDto> {
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
   */
  @Get()
  @ApiOperation({
    summary: 'Get list of communication sessions with flexible filtering',
    description: `
      Retrieve communication sessions with support for multiple query combinations.
      
      Query Parameters:
      - studentId (optional): Filter by specific student ID
      - mentorId (optional): Filter by specific mentor ID
      - counselorId (optional): Filter by specific counselor ID (counselor role only)
      - status (optional): Filter by session status
      - startDate (optional): Filter by start date
      - endDate (optional): Filter by end date
      - page (optional): Pagination page number
      - limit (optional): Results per page
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
    
    const sessionFilters = {
      ...filters,
      studentId,
      mentorId,
      counselorId,
    };
    
    const sessions = await this.commSessionService.getSessionsByRole(
      user.id,
      userRole,
      sessionFilters,
    );
    
    return sessions || [];
  }

  /**
   * Get communication session details
   * GET /api/services/comm-session/:id
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
    return session;
  }

  /**
   * Update a communication session
   * PATCH /api/services/comm-session/:id
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
    return updatedSession as any;
  }

  /**
   * Cancel a communication session
   * POST /api/services/comm-session/:id/cancel
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
    type: CommSessionResponseDto,
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
    @Param('id') sessionId: string,
    @Body() body?: { reason?: string },
  ): Promise<CommSessionResponseDto> {
    const cancelledSession = await this.commSessionService.cancelSession(
      sessionId,
      body?.reason || 'Cancelled by counselor',
    );
    
    return cancelledSession;
  }

  /**
   * Delete (soft delete) a communication session
   * DELETE /api/services/comm-session/:id
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

