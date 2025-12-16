import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileService } from '../../core/file/file.service';
import { UploadResultDto } from '../../core/file/dto/upload-result.dto';

/**
 * File Controller
 *
 * Handles file upload operations
 */
@ApiTags('Files')
@Controller('api/files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  /**
   * Upload file to S3
   */
  @Post('upload')
  @ApiOperation({ summary: 'Upload file to S3' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        folder: {
          type: 'string',
          description: 'S3 folder prefix (default: uploads)',
          example: 'resumes',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
  ): Promise<{ code: number; message: string; data: UploadResultDto }> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const result = await this.fileService.upload(file, folder || 'uploads');

    return {
      code: 200,
      message: 'File uploaded successfully',
      data: result,
    };
  }
}

