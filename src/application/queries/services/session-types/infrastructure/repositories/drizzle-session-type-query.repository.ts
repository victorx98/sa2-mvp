import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { sessionTypes } from '@infrastructure/database/schema/session-types.schema';
import { ISessionTypeQueryRepository, QuerySessionTypesDto } from '../../interfaces/session-type-query.repository.interface';
import { SessionTypeReadModel } from '../../models/session-type-read.model';

@Injectable()
export class DrizzleSessionTypeQueryRepository implements ISessionTypeQueryRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof import('@infrastructure/database/schema')>,
  ) {}

  async findSessionTypes(dto: QuerySessionTypesDto): Promise<SessionTypeReadModel[]> {
    const { serviceTypeCode } = dto;

    const conditions = [];
    if (serviceTypeCode) {
      conditions.push(eq(sessionTypes.serviceTypeCode, serviceTypeCode));
    }

    const result = await this.db
      .select({
        id: sessionTypes.id,
        code: sessionTypes.code,
        nameZh: sessionTypes.name,
        nameEn: sessionTypes.name,
        serviceTypeCode: sessionTypes.serviceTypeCode,
        description: sessionTypes.name,
        durationMinutes: sql<number>`60`,
        isActive: sql<boolean>`true`,
        isBilling: sessionTypes.isBilling,
        createdAt: sessionTypes.createdAt,
        updatedAt: sessionTypes.updatedAt,
      })
      .from(sessionTypes)
      .where(conditions.length > 0 ? eq(sessionTypes.serviceTypeCode, serviceTypeCode) : undefined);

    return result as SessionTypeReadModel[];
  }
}
