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
import { GapAnalysisService } from '@application/commands/services/gap-analysis.service';
import { GapAnalysisSessionMapper } from '@domains/services/sessions/gap-analysis/mappers/gap-analysis-session.mapper';
import { plainToInstance } from 'class-transformer';

// DTOs - Request
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsInt, Min, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateGapAnalysisRequestDto {
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
    example: 'Gap Analysis Session',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Session Description',
    example: 'Gap analysis session description',
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

export class UpdateGapAnalysisRequestDto {
  @ApiProperty({
    description: 'Session Title',
    example: 'Gap Analysis Session',
    required: false,
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Session Description',
    example: 'Gap analysis session description',
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
  duration?: number; // NEW: Added duration field
}

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

// DTOs - Response
export class GapAnalysisSessionResponseDto {
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

/**
 * API Layer - Counselor Gap Analysis Controller
 *
 * Route: /api/services/gap-analysis
 */
@ApiTags('Counselor Portal - Gap Analysis')
@Controller(`${ApiPrefix}/services/gap-analysis`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GapAnalysisController {
  constructor(
    private readonly gapAnalysisService: GapAnalysisService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new gap analysis session',
    description: `
      Creates a new gap analysis session asynchronously.
      
      Sync Flow (returns immediately):
      1. Create calendar slots for mentor and student
      2. Create session record with PENDING_MEETING status
      3. Return response with sessionId and status
      
      Async Flow (runs in background):
      1. Create meeting link via third-party API
      2. Update session with meeting_id and status=SCHEDULED
      3. Publish SESSION_BOOKED_EVENT
      
      Client should poll GET /api/services/gap-analysis/:id to check status and get meetingUrl
    `,
  })
  @ApiCreatedResponse({
    description: 'Session created successfully',
    type: CreateSessionResponseDto,
  })
  async createSession(
    @CurrentUser() user: User,
    @Body() dto: CreateGapAnalysisRequestDto,
  ): Promise<CreateSessionResponseDto> {
    const result = await this.gapAnalysisService.createSession({
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

    return {
      ...result,
      scheduledAt: typeof result.scheduledAt === 'string'
        ? result.scheduledAt
        : result.scheduledAt.toISOString(),
    };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @ApiOperation({
    summary: 'Get list of gap analysis sessions with flexible filtering',
    description: `
      Retrieve gap analysis sessions with support for multiple query combinations:
      
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
      - GET /api/services/gap-analysis (returns user's own sessions)
      - GET /api/services/gap-analysis?studentId=xxx (returns student's sessions)
      - GET /api/services/gap-analysis?mentorId=xxx (returns mentor's sessions)
      - GET /api/services/gap-analysis?mentorId=xxx&studentId=yyy (returns sessions for specific mentor-student pair)
    `,
  })
  @ApiOkResponse({
    description: 'Sessions retrieved successfully',
    type: GapAnalysisSessionResponseDto,
    isArray: true,
  })
  async getSessionsList(
    @CurrentUser() user: User,
    @Query('studentId') studentId?: string,
    @Query('mentorId') mentorId?: string,
    @Query('counselorId') counselorId?: string,
    @Query() filters?: any,
  ): Promise<GapAnalysisSessionResponseDto[]> {
    const userRole = user.roles?.[0] || 'student';
    
    // Build filter object with all ID parameters
    const sessionFilters = {
      ...filters,
      studentId,
      mentorId,
      counselorId,
    };
    
    // Fetch sessions with meeting data
    const sessions = await this.gapAnalysisService.getSessionsByRole(
      user.id,
      userRole,
      sessionFilters,
    );
    
    // Map sessions with meeting information to response DTO
    return GapAnalysisSessionMapper.toResponseDtos(sessions || []);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @ApiOperation({
    summary: 'Get gap analysis session details',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  async getSessionDetail(
    @Param('id') sessionId: string,
  ): Promise<GapAnalysisSessionResponseDto> {
    const session = await this.gapAnalysisService.getSessionById(sessionId);
    return GapAnalysisSessionMapper.toResponseDto(session);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a gap analysis session',
    description: 'Update session details like title, description, or scheduled time',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Session updated successfully',
    type: GapAnalysisSessionResponseDto,
  })
  async updateSession(
    @Param('id') sessionId: string,
    @Body() dto: UpdateGapAnalysisRequestDto,
  ): Promise<GapAnalysisSessionResponseDto> {
    const updatedSession = await this.gapAnalysisService.updateSession(
      sessionId,
      {
        title: dto.title,
        description: dto.description,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        duration: dto.duration, // NEW: Pass duration
      },
    );
    // NEW: Use mapper to ensure all fields including meeting info are properly mapped
    return GapAnalysisSessionMapper.toResponseDto(updatedSession);
  }

  /**
   * Cancel a gap analysis session
   * POST /api/services/gap-analysis/:id/cancel
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
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a gap analysis session',
    description: `
      Cancel an existing gap analysis session with optional reason.
      
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
    type: GapAnalysisSessionResponseDto,
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
  ): Promise<GapAnalysisSessionResponseDto> {
    const cancelledSession = await this.gapAnalysisService.cancelSession(
      sessionId,
      body?.reason || 'Cancelled by counselor',
    );
    
    // Return cancelled session with meeting info (similar to updateSession)
    return GapAnalysisSessionMapper.toResponseDto(cancelledSession);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a gap analysis session',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  async deleteSession(
    @Param('id') sessionId: string,
  ) {
    return this.gapAnalysisService.deleteSession(sessionId);
  }
}

