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
import { MockInterviewService } from '@application/commands/services/mock-interview.service';
import {
  CreateMockInterviewRequestDto,
  UpdateMockInterviewRequestDto,
} from '@api/dto/request/services/mock-interviews';
import {
  MockInterviewResponseDto,
  CreateMockInterviewResponseDto,
} from '@api/dto/response/services/mock-interviews';

/**
 * API Layer - Mock Interview Controller
 *
 * Responsibility:
 * - Define HTTP routes for mock interview management
 * - Extract and validate request parameters
 * - Call Application Layer services
 * - Return HTTP responses
 *
 * Route: /api/services/mock-interviews
 */
@ApiTags('Counselor Portal - Mock Interview')
@Controller(`${ApiPrefix}/services/mock-interviews`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MockInterviewController {
  constructor(
    private readonly mockInterviewService: MockInterviewService,
  ) {}

  /**
   * Create a new mock interview
   * POST /api/services/mock-interviews
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'student')
  @ApiOperation({
    summary: 'Create a new mock interview',
    description: `
      Creates a new AI-powered mock interview session.
      
      Flow:
      1. Create calendar slot for student (no mentor/counselor)
      2. Create interview record with SCHEDULED status
      3. Return response with sessionId and status
      
      Note: No third-party meeting creation (WebRTC-based)
    `,
  })
  @ApiCreatedResponse({
    description: 'Interview created successfully',
    type: CreateMockInterviewResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 409,
    description: 'Time conflict (student already scheduled)',
  })
  async createInterview(
    @CurrentUser() user: User,
    @Body() dto: CreateMockInterviewRequestDto,
  ): Promise<CreateMockInterviewResponseDto> {
    const result = await this.mockInterviewService.createInterview({
      studentId: dto.studentId,
      createdByCounselorId: user.roles?.includes('counselor') ? user.id : undefined,
      title: dto.title,
      scheduledAt: new Date(dto.scheduledAt),
      duration: dto.duration,
      interviewType: dto.interviewType,
      language: dto.language,
      companyName: dto.companyName,
      jobTitle: dto.jobTitle,
      jobDescription: dto.jobDescription,
      resumeText: dto.resumeText,
      interviewInstructions: dto.interviewInstructions,
      systemInstruction: dto.systemInstruction,
    });

    return {
      ...result,
      scheduledAt: typeof result.scheduledAt === 'string' 
        ? result.scheduledAt 
        : result.scheduledAt.toISOString(),
    };
  }

  /**
   * Get list of mock interviews
   * GET /api/services/mock-interviews
   */
  @Get()
  @ApiOperation({
    summary: 'Get list of mock interviews',
    description: `
      Retrieve mock interviews with filtering support.
      
      Query Parameters:
      - studentId (optional): Filter by specific student ID
      - status (optional): Filter by interview status
      - page (optional): Pagination page number
      - limit (optional): Results per page
    `,
  })
  @ApiOkResponse({
    description: 'Interviews retrieved successfully',
    type: MockInterviewResponseDto,
    isArray: true,
  })
  async getInterviewsList(
    @CurrentUser() user: User,
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<MockInterviewResponseDto[]> {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    
    const filters = {
      status: status as any,
      excludeDeleted: true,
    };

    // If studentId provided, query that student's interviews
    if (studentId) {
      return this.mockInterviewService.getInterviewsByStudent(studentId, filters, limitNum, offsetNum);
    }

    // Otherwise return empty (or implement role-based logic)
    return [];
  }

  /**
   * Get mock interview details
   * GET /api/services/mock-interviews/:id
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('counselor', 'student')
  @ApiOperation({
    summary: 'Get mock interview details',
    description: 'Retrieve detailed information about a specific mock interview',
  })
  @ApiParam({
    name: 'id',
    description: 'Interview ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Interview retrieved successfully',
    type: MockInterviewResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Interview not found',
  })
  async getInterviewDetail(
    @Param('id') interviewId: string,
  ): Promise<MockInterviewResponseDto> {
    const interview = await this.mockInterviewService.getInterviewById(interviewId);
    return interview;
  }

  /**
   * Update a mock interview
   * PATCH /api/services/mock-interviews/:id
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'student')
  @ApiOperation({
    summary: 'Update a mock interview',
    description: 'Update interview details like title, description, or scheduled time',
  })
  @ApiParam({
    name: 'id',
    description: 'Interview ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Interview updated successfully',
    type: MockInterviewResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Interview not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Time conflict detected',
  })
  async updateInterview(
    @Param('id') interviewId: string,
    @Body() dto: UpdateMockInterviewRequestDto,
  ): Promise<MockInterviewResponseDto> {
    const updatedInterview = await this.mockInterviewService.updateInterview(
      interviewId,
      {
        title: dto.title,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        duration: dto.duration,
        interviewType: dto.interviewType,
        language: dto.language,
        companyName: dto.companyName,
        jobTitle: dto.jobTitle,
        jobDescription: dto.jobDescription,
        resumeText: dto.resumeText,
        interviewInstructions: dto.interviewInstructions,
      },
    );
    return updatedInterview as any;
  }

  /**
   * Cancel a mock interview
   * POST /api/services/mock-interviews/:id/cancel
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'student')
  @ApiOperation({
    summary: 'Cancel a mock interview',
    description: `
      Cancel an existing mock interview with optional reason.
      
      Flow (immediate response):
      - Update interview status to CANCELLED
      - Release calendar slot
      - Return cancelled interview details
      
      Note: Only 'scheduled' interviews can be cancelled
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Interview ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Interview cancelled successfully',
    type: MockInterviewResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid interview status',
  })
  @ApiResponse({
    status: 404,
    description: 'Interview not found',
  })
  async cancelInterview(
    @Param('id') interviewId: string,
    @Body() body?: { reason?: string },
  ): Promise<MockInterviewResponseDto> {
    const cancelledInterview = await this.mockInterviewService.cancelInterview(
      interviewId,
      body?.reason || 'Cancelled by user',
    );
    
    return cancelledInterview;
  }

  /**
   * Delete (soft delete) a mock interview
   * DELETE /api/services/mock-interviews/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor')
  @ApiOperation({
    summary: 'Delete a mock interview',
    description: 'Soft delete a mock interview (marks as deleted)',
  })
  @ApiParam({
    name: 'id',
    description: 'Interview ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Interview deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Interview not found',
  })
  async deleteInterview(
    @Param('id') interviewId: string,
  ) {
    return this.mockInterviewService.deleteInterview(interviewId);
  }
}

