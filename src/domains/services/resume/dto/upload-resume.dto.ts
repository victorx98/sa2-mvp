import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class UploadResumeDto {
  @IsString()
  @IsNotEmpty()
  studentUserId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  jobTitle: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  sessionType?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fileName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  fileUrl: string;
}

