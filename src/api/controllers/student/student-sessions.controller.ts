import {
  Controller,
  Get,
  Param,
  UseGuards,
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
export class StudentSessionSummaryResponseDto {
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
 * API Layer - Student Sessions Controller
 *
 * Responsibility:
 * - Define HTTP routes for student to view their sessions
 * - Students can only view sessions, not create/update/delete
 * - Extract and validate request parameters
 * - Call Application Layer query services
 * - Return HTTP responses
 *
 * Route: /api/student/sessions
 */
@ApiTags('Student Portal - Sessions')
@Controller(`${ApiPrefix}/student/sessions`)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('student')
@ApiBearerAuth()
export class StudentSessionsController {
  constructor(
    private readonly regularMentoringQueryService: RegularMentoringQueryService,
  ) {}

  /**
   * Get list of all sessions for current student
   * GET /api/student/sessions
   *
   * @param user Current student user
   * @param filters Query filters
   * @returns List of sessions
   */
  @Get()
  @ApiOperation({
    summary: 'Get list of all my sessions',
    description: 'Retrieve all sessions booked for the current student (regular mentoring, gap analysis, AI career, etc.)',
  })
  @ApiOkResponse({
    description: 'Sessions retrieved successfully',
    type: StudentSessionSummaryResponseDto,
    isArray: true,
  })
  async getSessionsList(
    @CurrentUser() user: User,
  ): Promise<StudentSessionSummaryResponseDto[]> {
    const sessions = await this.regularMentoringQueryService.getStudentSessions(user.id);
    return plainToInstance(StudentSessionSummaryResponseDto, sessions, {
      enableImplicitConversion: true,
    });
  }

  /**
   * Get session details by ID
   * GET /api/student/sessions/:id
   *
   * @param sessionId Session ID
   * @returns Session details
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get my session details',
    description: 'Retrieve detailed information about a specific session',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Session retrieved successfully',
    type: StudentSessionSummaryResponseDto,
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
  ): Promise<StudentSessionSummaryResponseDto> {
    const session = await this.regularMentoringQueryService.getSessionById(sessionId);

    // Authorization check: verify current student is the student of this session
    if (session.studentUserId !== user.id) {
      throw new Error('Not authorized to view this session');
    }

    return plainToInstance(StudentSessionSummaryResponseDto, session, {
      enableImplicitConversion: true,
    });
  }
}

