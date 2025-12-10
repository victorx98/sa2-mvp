import { IsNotEmpty, IsString, IsEnum, IsDateString, IsInt, Min, IsArray, ArrayMinSize, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ClassType } from '../entities/class.entity';

export class MentorPriceInput {
  @IsNotEmpty()
  @IsString()
  mentorUserId: string;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  pricePerSession: number;
}

/**
 * DTO for creating a class
 */
export class CreateClassDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEnum(ClassType)
  type: ClassType;

  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  totalSessions: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MentorPriceInput)
  mentors: MentorPriceInput[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  students: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  counselors: string[];
}
