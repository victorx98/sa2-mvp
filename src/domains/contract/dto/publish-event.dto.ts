import { IsNotEmpty, IsString, IsObject, IsOptional } from "class-validator";

/**
 * Publish Event DTO
 * Used when publishing domain events
 */
export class PublishEventDto {
  @IsNotEmpty()
  @IsString()
  eventType: string;

  @IsNotEmpty()
  @IsString()
  aggregateId: string;

  @IsNotEmpty()
  @IsString()
  aggregateType: string;

  @IsNotEmpty()
  @IsObject()
  payload: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: {
    correlationId?: string;
    causationId?: string;
    publishedBy?: string;
  };
}
