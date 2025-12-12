import { Injectable, ConflictException, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { serviceReferences } from '@infrastructure/database/schema/service-references.schema';
import type { ServiceReferenceEntity } from './entities/service-reference.entity';
import { RegisterServiceDto } from './dto/register-service.dto';

@Injectable()
export class ServiceReferenceRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async findById(id: string): Promise<ServiceReferenceEntity | null> {
    const result = await this.db.query.serviceReferences.findFirst({
      where: eq(serviceReferences.id, id),
    });
    return result || null;
  }

  async create(dto: RegisterServiceDto): Promise<ServiceReferenceEntity> {
    const existing = await this.findById(dto.id);
    if (existing) {
      throw new ConflictException(
        `Service with ID ${dto.id} has already been registered`,
      );
    }

    // Map DTO fields (snake_case) to schema fields (camelCase)
    const [result] = await this.db
      .insert(serviceReferences)
      .values({
        id: dto.id,
        serviceType: dto.service_type,
        title: dto.title, // Include session title
        studentUserId: dto.student_user_id,
        providerUserId: dto.provider_user_id,
        consumedUnits: dto.consumed_units.toString(), // Convert to string for decimal type
        unitType: dto.unit_type,
        completedTime: dto.completed_time,
      })
      .returning();
    return result;
  }
}

