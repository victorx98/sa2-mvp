import { IsNotEmpty, IsUUID, IsString, IsNumber, IsIn, IsDate } from 'class-validator';

/**
 * DTO for registering a service
 */
export class RegisterServiceDto {
  @IsNotEmpty()
  @IsUUID()
  id: string; // Shared primary key

  @IsNotEmpty()
  @IsString()
  service_type: string;

  @IsNotEmpty()
  @IsUUID()
  student_user_id: string;

  @IsNotEmpty()
  @IsUUID()
  provider_user_id: string;

  @IsNotEmpty()
  @IsNumber()
  consumed_units: number;

  @IsNotEmpty()
  @IsIn(['hour', 'count'])
  unit_type: 'hour' | 'count';

  @IsNotEmpty()
  @IsDate()
  completed_time: Date;
}

