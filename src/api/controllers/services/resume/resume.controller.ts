import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
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
import { ResumeDomainService } from '@domains/services/resume/services/resume-domain.service';
import { ResumeService as ApplicationResumeService } from '@application/commands/services/resume.service';
import {
  UploadResumeRequestDto,
  SetFinalRequestDto,
  BillResumeRequestDto,
  CancelBillResumeRequestDto,
} from '@api/dto/request/services/resume';
import { ResumeResponseDto } from '@api/dto/response/services/resume';

@ApiTags('Resume Management')
@Controller(`${ApiPrefix}/services/resumes`)
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ResumeController {
  constructor(
    private readonly domainResumeService: ResumeDomainService,
    private readonly applicationResumeService: ApplicationResumeService,
  ) {}

  /**
   * Upload resume
   */
  @Post('upload')
  @Roles('admin', 'counselor', 'student')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload resume' })
  @ApiCreatedResponse({ description: 'Resume uploaded successfully' })
  async uploadResume(
    @Body() dto: UploadResumeRequestDto,
    @CurrentUser() user: User,
  ) {
    const entity = await this.domainResumeService.upload({
      studentUserId: dto.studentUserId,
      jobTitle: dto.jobTitle,
      sessionType: dto.sessionType,
      serviceType: dto.serviceType || 'Resume', // Default to 'Resume'
      fileName: dto.fileName,
      fileUrl: dto.fileUrl,
      uploadedBy: user.id,
    });

    return {
      code: HttpStatus.CREATED,
      message: 'Resume uploaded successfully',
      data: ResumeResponseDto.fromEntity(entity),
    };
  }

  /**
   * List resumes by student (grouped by job title)
   */
  @Get('student/:studentUserId')
  @Roles('admin', 'counselor', 'mentor', 'student')
  @ApiOperation({ summary: 'Get student resumes grouped by job title' })
  @ApiParam({ name: 'studentUserId', description: 'Student user ID' })
  @ApiOkResponse({ description: 'Resumes retrieved successfully' })
  async listResumesByStudent(
    @Param('studentUserId') studentUserId: string,
  ) {
    const enrichedGrouped = await this.applicationResumeService.listResumesWithDetails(studentUserId);
    return {
      code: HttpStatus.OK,
      message: 'Success',
      data: enrichedGrouped,
    };
  }

  /**
   * Set resume as final
   */
  @Post(':resumeId/set-final')
  @Roles('admin', 'counselor', 'student')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set resume as final version' })
  @ApiParam({ name: 'resumeId', description: 'Resume ID' })
  @ApiOkResponse({ description: 'Resume set as final successfully' })
  async setFinal(
    @Param('resumeId') resumeId: string,
    @Body() dto: SetFinalRequestDto,
    @CurrentUser() user: User,
  ) {
    const entity = await this.domainResumeService.setFinal(resumeId, user.id, dto.description);
    return {
      code: HttpStatus.OK,
      message: 'Resume set as final successfully',
      data: ResumeResponseDto.fromEntity(entity),
    };
  }

  /**
   * Cancel final status
   */
  @Post(':resumeId/cancel-final')
  @Roles('admin', 'counselor', 'student')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel final status' })
  @ApiParam({ name: 'resumeId', description: 'Resume ID' })
  @ApiOkResponse({ description: 'Final status canceled successfully' })
  async cancelFinal(
    @Param('resumeId') resumeId: string,
    @Body() dto: SetFinalRequestDto,
    @CurrentUser() user: User,
  ) {
    const entity = await this.domainResumeService.cancelFinal(resumeId, user.id, dto.description);
    return {
      code: HttpStatus.OK,
      message: 'Final status canceled successfully',
      data: ResumeResponseDto.fromEntity(entity),
    };
  }

  /**
   * Bill resume
   */
  @Post(':resumeId/bill')
  @Roles('admin', 'counselor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bill resume to mentor' })
  @ApiParam({ name: 'resumeId', description: 'Resume ID' })
  @ApiOkResponse({ description: 'Resume billed successfully' })
  async billResume(
    @Param('resumeId') resumeId: string,
    @Body() dto: BillResumeRequestDto,
    @CurrentUser() user: User,
  ) {
    const entity = await this.applicationResumeService.billResume(
      resumeId,
      {
        mentorId: dto.mentorId,
        description: dto.description,
        studentId: dto.studentId,
        serviceType: dto.serviceType,
      },
      user.id,
    );

    return {
      code: HttpStatus.OK,
      message: 'Resume billed successfully',
      data: ResumeResponseDto.fromEntity(entity),
    };
  }

  /**
   * Cancel bill resume
   */
  @Post(':resumeId/cancel-bill')
  @Roles('admin', 'counselor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel resume billing' })
  @ApiParam({ name: 'resumeId', description: 'Resume ID' })
  @ApiOkResponse({ description: 'Resume billing cancelled successfully' })
  async cancelBillResume(
    @Param('resumeId') resumeId: string,
    @Body() dto: CancelBillResumeRequestDto,
    @CurrentUser() user: User,
  ) {
    const entity = await this.applicationResumeService.cancelBillResume(
      resumeId,
      {
        description: dto.description,
        serviceType: dto.serviceType,
      },
      user.id,
    );

    return {
      code: HttpStatus.OK,
      message: 'Resume billing cancelled successfully',
      data: ResumeResponseDto.fromEntity(entity),
    };
  }

  /**
   * Delete resume (soft delete)
   */
  @Delete(':resumeId')
  @Roles('admin', 'counselor', 'student')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete resume' })
  @ApiParam({ name: 'resumeId', description: 'Resume ID' })
  @ApiOkResponse({ description: 'Resume deleted successfully' })
  async deleteResume(
    @Param('resumeId') resumeId: string,
    @CurrentUser() user: User,
  ) {
    await this.domainResumeService.delete(resumeId, user.id);
    return {
      code: HttpStatus.OK,
      message: 'Resume deleted successfully',
      data: null,
    };
  }
}

