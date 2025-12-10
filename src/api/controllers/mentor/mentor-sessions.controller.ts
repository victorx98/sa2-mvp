import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { User } from '@domains/identity/user/user-interface';
import { ApiPrefix } from '@api/api.constants';
import { RegularMentoringQueryService } from '@application/queries/services/regular-mentoring-query.service';
import { plainToInstance } from 'class-transformer';

/**
 * Response DTO
 */
export class SessionSummaryResponseDto {
  id: string;
  sessionType: string;
  studentUserId: string;
  mentorUserId: string;
  title: string;
  status: string;
  scheduledAt: string;
  completedAt?: string;
}

/**
 * API Layer - Mentor Sessions Controller
 *
 * Responsibility:
 * - Define HTTP routes for mentor to view their sessions
 * - Mentors can only view sessions, not create/update/delete
 * - Extract and validate request parameters
 * - Call Application Layer query services
 * - Return HTTP responses
 *
 * Route: /api/mentor/sessions
 */
@ApiTags('Mentor Portal - Sessions')
@Controller(`${ApiPrefix}/mentor/sessions`)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('mentor')
@ApiBearerAuth()
export class MentorSessionsController {
  constructor(
    private readonly regularMentoringQueryService: RegularMentoringQueryService,
  ) {}

  /**
   * Get list of all sessions for current mentor
   * GET /api/mentor/sessions
   *
   * @param user Current mentor user
   * @param filters Query filters
   * @returns List of sessions
   */
  @Get()
  @ApiOperation({
    summary: 'Get list of all mentoring sessions',
    description: 'Retrieve all mentoring sessions for the current mentor (regular mentoring, gap analysis, AI career, etc.)',
  })
  @ApiOkResponse({
    description: 'Sessions retrieved successfully',
    type: SessionSummaryResponseDto,
    isArray: true,
  })
  async getSessionsList(
    @CurrentUser() user: User,
  ): Promise<SessionSummaryResponseDto[]> {
    const sessions = await this.regularMentoringQueryService.getMentorSessions(user.id);
    return plainToInstance(SessionSummaryResponseDto, sessions, {
      enableImplicitConversion: true,
    });
  }

  /**
   * Get session details by ID
   * GET /api/mentor/sessions/:id
   *
   * @param sessionId Session ID
   * @returns Session details
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get session details',
    description: 'Retrieve detailed information about a specific session',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Session retrieved successfully',
    type: SessionSummaryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Not authorized to view this session',
  })
  async getSessionDetail(
    @Param('id') sessionId: string,
    @CurrentUser() user: User,
  ): Promise<SessionSummaryResponseDto> {
    const session = await this.regularMentoringQueryService.getSessionById(sessionId);

    // Authorization check: verify current mentor is the mentor of this session
    if (session.mentorUserId !== user.id) {
      throw new Error('Not authorized to view this session');
    }

    return plainToInstance(SessionSummaryResponseDto, session, {
      enableImplicitConversion: true,
    });
  }
}

