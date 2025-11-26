import { IsOptional, IsIn } from 'class-validator';

/**
 * DTO for querying session types
 */
export class GetSessionTypesDto {
  @IsOptional()
  @IsIn(['External', 'Internal'])
  code?: 'External' | 'Internal';
}

/**
 * Response DTO for session type
 */
export class SessionTypeDto {
  id: string;
  code: string;
  name: string;
  template_id: string | null;
  is_billing: boolean;
  created_at: Date;
  updated_at: Date;
}

