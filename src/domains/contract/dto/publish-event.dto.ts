import { IsNotEmpty, IsString, IsObject, IsOptional } from "class-validator";

/**
 * DTO for publishing domain events (发布领域事件的DTO)
 * Used when publishing domain events (用于发布领域事件)
 */
export class PublishEventDto {
  @IsNotEmpty()
  @IsString()
  eventType: string; // Event type (事件类型)

  @IsNotEmpty()
  @IsString()
  aggregateId: string; // Aggregate root ID (聚合根ID)

  @IsNotEmpty()
  @IsString()
  aggregateType: string; // Aggregate root type (聚合根类型)

  @IsNotEmpty()
  @IsObject()
  payload: Record<string, unknown>; // Event payload (事件负载)

  @IsOptional()
  @IsObject()
  metadata?: {
    correlationId?: string; // Correlation ID (关联ID)
    causationId?: string; // Causation ID (原因ID)
    publishedBy?: string; // Publisher ID (发布人ID)
  };
}
