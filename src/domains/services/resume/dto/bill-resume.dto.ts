import { IsString, IsNotEmpty } from 'class-validator';

export class BillResumeDto {
  @IsString()
  @IsNotEmpty()
  resumeId: string;

  @IsString()
  @IsNotEmpty()
  mentorUserId: string;
}

