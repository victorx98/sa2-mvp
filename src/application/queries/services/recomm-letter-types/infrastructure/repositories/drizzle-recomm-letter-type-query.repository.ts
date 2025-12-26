import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, asc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { recommLetterTypes } from '@infrastructure/database/schema/recomm-letter-types.schema';
import { IRecommLetterTypeQueryRepository, RECOMM_LETTER_TYPE_QUERY_REPOSITORY } from '../../interfaces/recomm-letter-type-query.repository.interface';
import { QueryRecommLetterTypesDto } from '../../dto/recomm-letter-type-query.dto';
import { RecommLetterTypeReadModel, RecommLetterTypeTreeNode } from '../../models/recomm-letter-type-read.model';

@Injectable()
export class DrizzleRecommLetterTypeQueryRepository implements IRecommLetterTypeQueryRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof import('@infrastructure/database/schema')>,
  ) {}

  async findRecommLetterTypes(dto: QueryRecommLetterTypesDto): Promise<RecommLetterTypeReadModel[]> {
    const { serviceTypeCode, parentCode } = dto;

    const conditions = [];
    if (serviceTypeCode) {
      conditions.push(eq(recommLetterTypes.serviceTypeCode, serviceTypeCode));
    }
    if (parentCode !== undefined) {
      conditions.push(eq(recommLetterTypes.parentId, parentCode));
    }

    const result = await this.db
      .select({
        id: recommLetterTypes.id,
        code: recommLetterTypes.typeCode,
        nameZh: recommLetterTypes.typeName,
        nameEn: recommLetterTypes.typeName,
        serviceTypeCode: recommLetterTypes.serviceTypeCode,
        parentId: recommLetterTypes.parentId,
        level: sql<number>`0`,
        sortOrder: sql<number>`0`,
        isActive: recommLetterTypes.active,
        createdAt: recommLetterTypes.createdAt,
        updatedAt: recommLetterTypes.updatedAt,
      })
      .from(recommLetterTypes)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(recommLetterTypes.typeCode));

    return result as unknown as RecommLetterTypeReadModel[];
  }

  async getTypesTree(serviceTypeCode?: string): Promise<RecommLetterTypeTreeNode[]> {
    const allTypes = await this.findRecommLetterTypes({ serviceTypeCode });

    const buildTree = (parentId?: string): RecommLetterTypeTreeNode[] => {
      return allTypes
        .filter((type) => type.parentId === parentId)
        .map((type) => ({
          code: type.code,
          nameZh: type.nameZh,
          nameEn: type.nameEn,
          children: buildTree(type.id),
        }));
    };

    return buildTree(undefined);
  }
}
