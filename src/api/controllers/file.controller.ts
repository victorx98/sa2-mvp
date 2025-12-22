import {
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Body,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
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

  /**
   * Get presigned download URL
   */
  @Get('download-url')
  @ApiOperation({ summary: 'Get presigned download URL for S3 file' })
  @ApiQuery({
    name: 'fileUrl',
    description: 'S3 file URL',
    example: 'https://bucket.s3.amazonaws.com/uploads/xxx.pdf',
  })
  @ApiQuery({
    name: 'expiresIn',
    description: 'URL expiration time in seconds (default: 900)',
    required: false,
    example: 900,
  })
  async getDownloadUrl(
    @Query('fileUrl') fileUrl: string,
    @Query('expiresIn') expiresIn?: number,
  ): Promise<{ code: number; message: string; data: { downloadUrl: string; expiresIn: number } }> {
    if (!fileUrl) {
      throw new BadRequestException('fileUrl is required');
    }

    const expires = expiresIn ? parseInt(expiresIn.toString()) : 900;
    const downloadUrl = await this.fileService.getDownloadUrl(fileUrl, expires);

    return {
      code: 200,
      message: 'Download URL generated successfully',
      data: {
        downloadUrl,
        expiresIn: expires,
      },
    };
  }
}

