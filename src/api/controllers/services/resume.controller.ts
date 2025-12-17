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
import { ResumeService as DomainResumeService } from '@domains/services/resume/services/resume.service';
import { ResumeService as ApplicationResumeService } from '@application/commands/services/resume.service';
import { UploadResumeDto } from '@domains/services/resume/dto/upload-resume.dto';
import { BillResumeDto, CancelBillResumeDto } from '@domains/services/resume/dto/bill-resume.dto';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetFinalDto {
  @ApiProperty({ description: 'Description', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}

@ApiTags('Resume Management')
@Controller(`${ApiPrefix}/services/resumes`)
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ResumeController {
  constructor(
    private readonly domainResumeService: DomainResumeService,
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
    @Body() dto: UploadResumeDto,
    @CurrentUser() user: User,
  ) {
    const data = await this.domainResumeService.upload(dto, user.id);
    return {
      code: HttpStatus.CREATED,
      message: 'Resume uploaded successfully',
      data,
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
    const data = await this.domainResumeService.listByStudent(studentUserId);
    return {
      code: HttpStatus.OK,
      message: 'Success',
      data,
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
    @Body() dto: SetFinalDto,
    @CurrentUser() user: User,
  ) {
    const data = await this.domainResumeService.setFinal(resumeId, user.id, dto.description);
    return {
      code: HttpStatus.OK,
      message: 'Resume set as final successfully',
      data,
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
    @Body() dto: SetFinalDto,
    @CurrentUser() user: User,
  ) {
    const data = await this.domainResumeService.cancelFinal(resumeId, user.id, dto.description);
    return {
      code: HttpStatus.OK,
      message: 'Final status canceled successfully',
      data,
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
    @Body() dto: BillResumeDto,
    @CurrentUser() user: User,
  ) {
    const data = await this.applicationResumeService.billResume(resumeId, dto, user.id);
    return {
      code: HttpStatus.OK,
      message: 'Resume billed successfully',
      data,
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
    @Body() dto: CancelBillResumeDto,
    @CurrentUser() user: User,
  ) {
    const data = await this.applicationResumeService.cancelBillResume(resumeId, dto, user.id);
    return {
      code: HttpStatus.OK,
      message: 'Resume billing cancelled successfully',
      data,
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

