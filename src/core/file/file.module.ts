import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileService } from './file.service';

/**
 * File Module
 *
 * Provides file upload functionality (AWS S3)
 */
@Module({
  imports: [ConfigModule],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}

