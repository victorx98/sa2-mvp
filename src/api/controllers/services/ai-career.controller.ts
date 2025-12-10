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
import { AiCareerService } from '@application/commands/services/ai-career.service';
import { AiCareerSessionMapper } from '@domains/services/sessions/ai-career/mappers/ai-career-session.mapper';
import { plainToInstance } from 'class-transformer';

// DTOs - Request
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsInt, Min, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateAiCareerRequestDto {
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
    example: 'AI Career Assessment',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Session Description',
    example: 'AI career assessment session description',
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

export class UpdateAiCareerRequestDto {
  @ApiProperty({
    description: 'Session Title',
    example: 'AI Career Assessment',
    required: false,
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Session Description',
    example: 'AI career assessment session description',
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
export class AiCareerSessionResponseDto {
  id: string;
  meetingId: string;
  sessionType: string;
  sessionTypeId?: string;
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
  meeting?: MeetingDto;
}

export class CreateSessionResponseDto {
  sessionId: string;
  status: string;
  scheduledAt: string;
  holdId?: string;
}

/**
 * API Layer - Counselor AI Career Controller
 *
 * Route: /api/services/ai-career
 */
@ApiTags('Counselor Portal - AI Career')
@Controller(`${ApiPrefix}/services/ai-career`)
@UseGuards(JwtAuthGuard)
@Roles('counselor')
@ApiBearerAuth()
export class AiCareerController {
  constructor(
    private readonly aiCareerService: AiCareerService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new AI career session',
    description: `
      Creates a new AI career session asynchronously.
      
      Sync Flow (returns immediately):
      1. Create calendar slots for mentor and student
      2. Create session record with PENDING_MEETING status
      3. Return response with sessionId and status
      
      Async Flow (runs in background):
      1. Create meeting link via third-party API
      2. Update session with meeting_id and status=SCHEDULED
      3. Publish SESSION_BOOKED_EVENT
      
      Client should poll GET /api/services/ai-career/:id to check status and get meetingUrl
    `,
  })
  @ApiCreatedResponse({
    description: 'Session created successfully',
    type: CreateSessionResponseDto,
  })
  async createSession(
    @CurrentUser() user: User,
    @Body() dto: CreateAiCareerRequestDto,
  ): Promise<CreateSessionResponseDto> {
    const result = await this.aiCareerService.createSession({
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
  @ApiOperation({
    summary: 'Get list of AI career sessions with flexible filtering',
    description: `
      Retrieve AI career sessions with support for multiple query combinations:
      
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
      - GET /api/services/ai-career (returns user's own sessions)
      - GET /api/services/ai-career?studentId=xxx (returns student's sessions)
      - GET /api/services/ai-career?mentorId=xxx (returns mentor's sessions)
      - GET /api/services/ai-career?mentorId=xxx&studentId=yyy (returns sessions for specific mentor-student pair)
    `,
  })
  @ApiOkResponse({
    description: 'Sessions retrieved successfully',
    type: AiCareerSessionResponseDto,
    isArray: true,
  })
  async getSessionsList(
    @CurrentUser() user: User,
    @Query('studentId') studentId?: string,
    @Query('mentorId') mentorId?: string,
    @Query('counselorId') counselorId?: string,
    @Query() filters?: any,
  ): Promise<AiCareerSessionResponseDto[]> {
    const userRole = user.roles?.[0] || 'student';
    
    // Build filter object with all ID parameters
    const sessionFilters = {
      ...filters,
      studentId,
      mentorId,
      counselorId,
    };
    
    // Fetch sessions with meeting data
    const sessions = await this.aiCareerService.getSessionsByRole(
      user.id,
      userRole,
      sessionFilters,
    );
    
    // Map sessions with meeting information to response DTO
    return AiCareerSessionMapper.toResponseDtos(sessions || []);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get AI career session details',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  async getSessionDetail(
    @Param('id') sessionId: string,
  ): Promise<AiCareerSessionResponseDto> {
    const session = await this.aiCareerService.getSessionById(sessionId);
    return AiCareerSessionMapper.toResponseDto(session);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update an AI career session',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  async updateSession(
    @Param('id') sessionId: string,
    @Body() dto: UpdateAiCareerRequestDto,
  ): Promise<AiCareerSessionResponseDto> {
    const updatedSession = await this.aiCareerService.updateSession(
      sessionId,
      {
        title: dto.title,
        description: dto.description,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        duration: dto.duration,
      },
    );
    return AiCareerSessionMapper.toResponseDto(updatedSession);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an AI career session',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  async cancelSession(
    @Param('id') sessionId: string,
    @Body() body?: { reason?: string },
  ) {
    return this.aiCareerService.cancelSession(
      sessionId,
      body?.reason || 'Cancelled by counselor',
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete an AI career session',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  async deleteSession(
    @Param('id') sessionId: string,
  ) {
    return this.aiCareerService.deleteSession(sessionId);
  }
}

