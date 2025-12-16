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
import { ResumeService } from '@domains/services/resume/services/resume.service';
import { ResumeBillingService } from '@domains/services/resume/services/resume-billing.service';
import { UploadResumeDto } from '@domains/services/resume/dto/upload-resume.dto';
import { BillResumeDto } from '@domains/services/resume/dto/bill-resume.dto';

@ApiTags('Resume Management')
@Controller(`${ApiPrefix}/resume`)
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ResumeController {
  constructor(
    private readonly resumeService: ResumeService,
    private readonly resumeBillingService: ResumeBillingService,
  ) {}

  /**
   * Upload resume
   */
  @Post('resumes')
  @Roles('admin', 'counselor', 'student')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload resume' })
  @ApiCreatedResponse({ description: 'Resume uploaded successfully' })
  async uploadResume(
    @Body() dto: UploadResumeDto,
    @CurrentUser() user: User,
  ) {
    const data = await this.resumeService.upload(dto, user.id);
    return {
      code: HttpStatus.CREATED,
      message: 'Resume uploaded successfully',
      data,
    };
  }

  /**
   * List resumes by student (grouped by job title)
   */
  @Get('resumes/student/:studentUserId')
  @Roles('admin', 'counselor', 'mentor', 'student')
  @ApiOperation({ summary: 'Get student resumes grouped by job title' })
  @ApiParam({ name: 'studentUserId', description: 'Student user ID' })
  @ApiOkResponse({ description: 'Resumes retrieved successfully' })
  async listResumesByStudent(
    @Param('studentUserId') studentUserId: string,
  ) {
    const data = await this.resumeService.listByStudent(studentUserId);
    return {
      code: HttpStatus.OK,
      message: 'Success',
      data,
    };
  }

  /**
   * Set resume as final
   */
  @Post('resumes/:resumeId/set-final')
  @Roles('admin', 'counselor', 'student')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set resume as final version' })
  @ApiParam({ name: 'resumeId', description: 'Resume ID' })
  @ApiOkResponse({ description: 'Resume set as final successfully' })
  async setFinal(
    @Param('resumeId') resumeId: string,
    @CurrentUser() user: User,
  ) {
    const data = await this.resumeService.setFinal(resumeId, user.id);
    return {
      code: HttpStatus.OK,
      message: 'Resume set as final successfully',
      data,
    };
  }

  /**
   * Cancel final status
   */
  @Post('resumes/:resumeId/cancel-final')
  @Roles('admin', 'counselor', 'student')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel final status' })
  @ApiParam({ name: 'resumeId', description: 'Resume ID' })
  @ApiOkResponse({ description: 'Final status canceled successfully' })
  async cancelFinal(
    @Param('resumeId') resumeId: string,
    @CurrentUser() user: User,
  ) {
    const data = await this.resumeService.cancelFinal(resumeId, user.id);
    return {
      code: HttpStatus.OK,
      message: 'Final status canceled successfully',
      data,
    };
  }

  /**
   * Bill resume
   */
  @Post('billing')
  @Roles('admin', 'counselor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bill resume to mentor' })
  @ApiOkResponse({ description: 'Resume billed successfully' })
  async billResume(
    @Body() dto: BillResumeDto,
    @CurrentUser() user: User,
  ) {
    const data = await this.resumeBillingService.billResume(dto, user.id);
    return {
      code: HttpStatus.OK,
      message: 'Resume billed successfully',
      data,
    };
  }

  /**
   * Delete resume (soft delete)
   */
  @Delete('resumes/:resumeId')
  @Roles('admin', 'counselor', 'student')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete resume' })
  @ApiParam({ name: 'resumeId', description: 'Resume ID' })
  @ApiOkResponse({ description: 'Resume deleted successfully' })
  async deleteResume(
    @Param('resumeId') resumeId: string,
    @CurrentUser() user: User,
  ) {
    await this.resumeService.delete(resumeId, user.id);
    return {
      code: HttpStatus.OK,
      message: 'Resume deleted successfully',
      data: null,
    };
  }
}

