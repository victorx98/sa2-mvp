/**
 * Drizzle MentorPayableLedger Repository (Drizzle导师应付账款仓储)
 * Implementation of IMentorPayableLedgerRepository using Drizzle ORM (使用Drizzle ORM实现IMentorPayableLedgerRepository)
 */

import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, sql, desc, isNull, isNotNull } from 'drizzle-orm';
import { MentorPayableLedger } from '../../entities/mentor-payable-ledger.entity';
import {
  IMentorPayableLedgerRepository,
  MentorPayableLedgerSearchCriteria,
  MentorPayableLedgerSearchResult,
  MENTOR_PAYABLE_LEDGER_REPOSITORY,
} from '../../repositories/mentor-payable-ledger.repository.interface';
import { MentorPayableLedgerMapper } from '../../infrastructure/mappers/mentor-payable-ledger.mapper';
import * as schema from '@infrastructure/database/schema';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';

@Injectable()
export class DrizzleMentorPayableLedgerRepository implements IMentorPayableLedgerRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly mapper: MentorPayableLedgerMapper,
  ) {}

  /**
   * Find mentor payable ledger by ID (通过ID查找导师应付账款)
   */
  async findById(id: string): Promise<MentorPayableLedger | null> {
    const [record] = await this.db
      .select()
      .from(schema.mentorPayableLedgers)
      .where(eq(schema.mentorPayableLedgers.id, id));

    if (!record) {
      return null;
    }

    return this.mapper.toDomain(record);
  }

  /**
   * Find mentor payable ledgers by mentor ID (通过导师ID查找导师应付账款)
   */
  async findByMentorId(mentorId: string): Promise<MentorPayableLedger[]> {
    const records = await this.db
      .select()
      .from(schema.mentorPayableLedgers)
      .where(eq(schema.mentorPayableLedgers.mentorId, mentorId))
      .orderBy(desc(schema.mentorPayableLedgers.createdAt));

    return records.map((record) => this.mapper.toDomain(record));
  }

  /**
   * Find unsettled ledgers for a mentor (查找导师的未结算账款)
   */
  async findUnsettledByMentorId(mentorId: string): Promise<MentorPayableLedger[]> {
    const records = await this.db
      .select()
      .from(schema.mentorPayableLedgers)
      .where(
        and(
          eq(schema.mentorPayableLedgers.mentorId, mentorId),
          isNull(schema.mentorPayableLedgers.settlementId),
        ),
      )
      .orderBy(desc(schema.mentorPayableLedgers.createdAt));

    return records.map((record) => this.mapper.toDomain(record));
  }

  /**
   * Find ledgers by settlement ID (通过结算ID查找账款)
   */
  async findBySettlementId(settlementId: string): Promise<MentorPayableLedger[]> {
    const records = await this.db
      .select()
      .from(schema.mentorPayableLedgers)
      .where(eq(schema.mentorPayableLedgers.settlementId, settlementId))
      .orderBy(desc(schema.mentorPayableLedgers.createdAt));

    return records.map((record) => this.mapper.toDomain(record));
  }

  /**
   * Find original ledger by reference ID (通过关联ID查找原始账款)
   */
  async findOriginalByReferenceId(referenceId: string): Promise<MentorPayableLedger | null> {
    const [record] = await this.db
      .select()
      .from(schema.mentorPayableLedgers)
      .where(
        and(
          eq(schema.mentorPayableLedgers.referenceId, referenceId),
          isNull(schema.mentorPayableLedgers.originalId),
        ),
      );

    if (!record) {
      return null;
    }

    return this.mapper.toDomain(record);
  }

  /**
   * Search mentor payable ledgers by criteria (根据条件搜索导师应付账款)
   */
  async search(criteria: MentorPayableLedgerSearchCriteria): Promise<MentorPayableLedgerSearchResult> {
    const {
      mentorId,
      settlementId,
      referenceId,
      studentId,
      sessionTypeCode,
      settlementStatus,
      adjustmentStatus,
      createdAfter,
      createdBefore,
      page = 1,
      pageSize = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = criteria;

    // Build where conditions
    const conditions: any[] = [];

    if (mentorId) {
      conditions.push(eq(schema.mentorPayableLedgers.mentorId, mentorId));
    }

    if (settlementId) {
      conditions.push(eq(schema.mentorPayableLedgers.settlementId, settlementId));
    }

    if (referenceId) {
      conditions.push(eq(schema.mentorPayableLedgers.referenceId, referenceId));
    }

    if (studentId) {
      conditions.push(eq(schema.mentorPayableLedgers.studentId, studentId));
    }

    if (sessionTypeCode) {
      conditions.push(eq(schema.mentorPayableLedgers.sessionTypeCode, sessionTypeCode));
    }

    // Settlement status filter
    if (settlementStatus === 'settled') {
      conditions.push(isNotNull(schema.mentorPayableLedgers.settlementId));
    } else if (settlementStatus === 'unsettled') {
      conditions.push(isNull(schema.mentorPayableLedgers.settlementId));
    }

    // Adjustment status filter
    if (adjustmentStatus === 'original') {
      conditions.push(isNull(schema.mentorPayableLedgers.originalId));
    } else if (adjustmentStatus === 'adjustment') {
      conditions.push(isNotNull(schema.mentorPayableLedgers.originalId));
    }

    // Date range filters
    if (createdAfter) {
      conditions.push(sql`${schema.mentorPayableLedgers.createdAt} >= ${createdAfter}`);
    }

    if (createdBefore) {
      conditions.push(sql`${schema.mentorPayableLedgers.createdAt} <= ${createdBefore}`);
    }

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.mentorPayableLedgers)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0]?.count || 0);

    // Calculate pagination
    const skipCount = (page - 1) * pageSize;
    const totalPages = Math.ceil(total / pageSize);

    // Apply sorting
    let orderBy;
    switch (sortBy) {
      case 'mentorId':
        orderBy = schema.mentorPayableLedgers.mentorId;
        break;
      case 'referenceId':
        orderBy = schema.mentorPayableLedgers.referenceId;
        break;
      case 'sessionTypeCode':
        orderBy = schema.mentorPayableLedgers.sessionTypeCode;
        break;
      case 'createdAt':
      default:
        orderBy = schema.mentorPayableLedgers.createdAt;
        break;
    }

    // Build and execute search query
    const query = this.db.select().from(schema.mentorPayableLedgers);

    const records = await (conditions.length > 0
      ? query.where(and(...conditions))
      : query
    )
      .orderBy(sortOrder === 'ASC' ? orderBy : desc(orderBy))
      .limit(pageSize)
      .offset(skipCount);

    // Convert records to domain entities
    const data = records.map((record) => this.mapper.toDomain(record));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Save a new mentor payable ledger (保存新导师应付账款)
   */
  async save(ledger: MentorPayableLedger): Promise<MentorPayableLedger> {
    const record = this.mapper.toPersistence(ledger);

    const [result] = await this.db.insert(schema.mentorPayableLedgers).values(record).returning();

    return this.mapper.toDomain(result);
  }

  /**
   * Update an existing mentor payable ledger (更新现有导师应付账款)
   */
  async update(ledger: MentorPayableLedger): Promise<MentorPayableLedger> {
    const record = this.mapper.toPersistence(ledger);

    const [result] = await this.db
      .update(schema.mentorPayableLedgers)
      .set(record)
      .where(eq(schema.mentorPayableLedgers.id, ledger.getId()))
      .returning();

    if (!result) {
      throw new Error(`Mentor payable ledger with ID ${ledger.getId()} not found`);
    }

    return this.mapper.toDomain(result);
  }

  /**
   * Get total unsettled amount for a mentor (获取导师的未结算总额)
   */
  async getTotalUnsettledAmount(mentorId: string): Promise<number> {
    const [result] = await this.db
      .select({
        total: sql<number>`sum(${schema.mentorPayableLedgers.amount})`,
      })
      .from(schema.mentorPayableLedgers)
      .where(
        and(
          eq(schema.mentorPayableLedgers.mentorId, mentorId),
          isNull(schema.mentorPayableLedgers.settlementId),
        ),
      );

    return Number(result.total || 0);
  }

  /**
   * Execute operations within a transaction (在事务中执行操作)
   */
  async withTransaction<T>(fn: (repo: IMentorPayableLedgerRepository) => Promise<T>): Promise<T> {
    return await this.db.transaction(async (tx) => {
      // Create a new repository instance with the transaction
      const transactionalRepo = new DrizzleMentorPayableLedgerRepository(
        tx as any,
        this.mapper,
      );
      return await fn(transactionalRepo);
    });
  }
}
