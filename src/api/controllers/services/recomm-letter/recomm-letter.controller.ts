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
import { RecommLetterDomainService } from '@domains/services/recomm-letter/services/recomm-letter-domain.service';
import { RecommLetterService as ApplicationRecommLetterService } from '@application/commands/services/recomm-letter.service';
import {
  UploadRecommLetterRequestDto,
  BillRecommLetterRequestDto,
  CancelBillRecommLetterRequestDto,
} from '@api/dto/request/services/recomm-letter';
import { RecommLetterResponseDto } from '@api/dto/response/services/recomm-letter';

@ApiTags('Recommendation Letter Management')
@Controller(`${ApiPrefix}/services/recomm-letters`)
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RecommLetterController {
  constructor(
    private readonly domainRecommLetterService: RecommLetterDomainService,
    private readonly applicationRecommLetterService: ApplicationRecommLetterService,
  ) {}

  /**
   * Upload recommendation letter (counselor only)
   */
  @Post('upload')
  @Roles('admin', 'counselor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload recommendation letter (counselor only)' })
  @ApiCreatedResponse({ description: 'Recommendation letter uploaded successfully' })
  async uploadRecommLetter(
    @Body() dto: UploadRecommLetterRequestDto,
    @CurrentUser() user: User,
  ) {
    const entity = await this.domainRecommLetterService.upload({
      studentUserId: dto.studentUserId,
      letterTypeId: dto.letterTypeId,
      packageTypeId: dto.packageTypeId,
      serviceType: dto.serviceType,
      fileName: dto.fileName,
      fileUrl: dto.fileUrl,
      uploadedBy: user.id,
    });

    return {
      code: HttpStatus.CREATED,
      message: 'Recommendation letter uploaded successfully',
      data: RecommLetterResponseDto.fromEntity(entity),
    };
  }

  /**
   * List recommendation letters by student
   */
  @Get('student/:studentUserId')
  @Roles('admin', 'counselor', 'mentor', 'student')
  @ApiOperation({ summary: 'Get student recommendation letters' })
  @ApiParam({ name: 'studentUserId', description: 'Student user ID' })
  @ApiOkResponse({ description: 'Recommendation letters retrieved successfully' })
  async listRecommLettersByStudent(
    @Param('studentUserId') studentUserId: string,
  ) {
    const enrichedLetters = await this.applicationRecommLetterService.listRecommLettersWithDetails(studentUserId);
    
    return {
      code: HttpStatus.OK,
      message: 'Success',
      data: enrichedLetters,
    };
  }

  /**
   * Bill recommendation letter (counselor only)
   */
  @Post(':letterId/bill')
  @Roles('admin', 'counselor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bill recommendation letter to mentor (counselor only)' })
  @ApiParam({ name: 'letterId', description: 'Recommendation letter ID' })
  @ApiOkResponse({ description: 'Recommendation letter billed successfully' })
  async billRecommLetter(
    @Param('letterId') letterId: string,
    @Body() dto: BillRecommLetterRequestDto,
    @CurrentUser() user: User,
  ) {
    const entity = await this.applicationRecommLetterService.billRecommLetter(
      letterId,
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
      message: 'Recommendation letter billed successfully',
      data: RecommLetterResponseDto.fromEntity(entity),
    };
  }

  /**
   * Cancel bill recommendation letter (counselor only)
   */
  @Post(':letterId/cancel-bill')
  @Roles('admin', 'counselor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel recommendation letter billing (counselor only)' })
  @ApiParam({ name: 'letterId', description: 'Recommendation letter ID' })
  @ApiOkResponse({ description: 'Recommendation letter billing cancelled successfully' })
  async cancelBillRecommLetter(
    @Param('letterId') letterId: string,
    @Body() dto: CancelBillRecommLetterRequestDto,
    @CurrentUser() user: User,
  ) {
    const entity = await this.applicationRecommLetterService.cancelBillRecommLetter(
      letterId,
      {
        description: dto.description,
        serviceType: dto.serviceType,
      },
      user.id,
    );

    return {
      code: HttpStatus.OK,
      message: 'Recommendation letter billing cancelled successfully',
      data: RecommLetterResponseDto.fromEntity(entity),
    };
  }

  /**
   * Delete recommendation letter (soft delete, counselor only)
   */
  @Delete(':letterId')
  @Roles('admin', 'counselor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete recommendation letter (counselor only)' })
  @ApiParam({ name: 'letterId', description: 'Recommendation letter ID' })
  @ApiOkResponse({ description: 'Recommendation letter deleted successfully' })
  async deleteRecommLetter(
    @Param('letterId') letterId: string,
    @CurrentUser() user: User,
  ) {
    await this.domainRecommLetterService.delete(letterId, user.id);
    return {
      code: HttpStatus.OK,
      message: 'Recommendation letter deleted successfully',
      data: null,
    };
  }
}

