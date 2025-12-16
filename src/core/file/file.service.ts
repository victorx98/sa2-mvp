import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { UploadResultDto } from './dto/upload-result.dto';

/**
 * File Service - AWS S3 file upload
 */
@Injectable()
export class FileService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly maxFileSizeMB: number;

  constructor() {
    // Initialize S3 client
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    this.bucketName = process.env.S3_BUCKET!;
    this.maxFileSizeMB = parseInt(process.env.FILE_MAX_SIZE_MB || '10');

    // Validate required environment variables
    if (!this.bucketName) {
      throw new Error('S3_BUCKET environment variable is required');
    }
  }

  /**
   * Upload file to S3
   * @param file - File buffer and metadata
   * @param folder - S3 folder prefix (e.g., 'resumes', 'recommendations')
   * @returns Upload result with file URL
   */
  async upload(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<UploadResultDto> {
    // Validate file size
    const maxSizeBytes = this.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `File size exceeds ${this.maxFileSizeMB}MB limit`,
      );
    }

    // Generate unique file name
    const fileExtension = file.originalname.split('.').pop();
    const uniqueFileName = `${randomUUID()}-${file.originalname}`;
    const s3Key = `${folder}/${uniqueFileName}`;

    try {
      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      // Construct file URL
      const fileUrl = `https://${this.bucketName}.s3.amazonaws.com/${s3Key}`;

      return {
        fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        contentType: file.mimetype,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to upload file to S3: ${error.message}`,
      );
    }
  }
}

