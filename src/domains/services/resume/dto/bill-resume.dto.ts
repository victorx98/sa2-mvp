import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class BillResumeDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  mentorId: string;

  @IsString()
  @IsOptional()
  serviceType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}

export class CancelBillResumeDto {
  @IsString()
  @IsOptional()
  serviceType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}

