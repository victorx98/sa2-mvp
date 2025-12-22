/**
 * Drizzle MentorPaymentInfo Repository (Drizzle导师支付信息仓储)
 * Implementation of IMentorPaymentInfoRepository using Drizzle ORM (使用Drizzle ORM实现IMentorPaymentInfoRepository)
 */

import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc } from 'drizzle-orm';
import { MentorPaymentInfo } from '../../entities/mentor-payment-info.entity';
import {
  IMentorPaymentInfoRepository,
  MENTOR_PAYMENT_INFO_REPOSITORY,
} from '../../repositories/mentor-payment-info.repository.interface';
import { MentorPaymentInfoMapper } from '../../infrastructure/mappers/mentor-payment-info.mapper';
import * as schema from '@infrastructure/database/schema';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';

@Injectable()
export class DrizzleMentorPaymentInfoRepository implements IMentorPaymentInfoRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly mapper: MentorPaymentInfoMapper,
  ) {}

  /**
   * Find mentor payment info by ID (通过ID查找导师支付信息)
   */
  async findById(id: string): Promise<MentorPaymentInfo | null> {
    const [record] = await this.db
      .select()
      .from(schema.mentorPaymentInfos)
      .where(eq(schema.mentorPaymentInfos.id, id));

    if (!record) {
      return null;
    }

    return this.mapper.toDomain(record);
  }

  /**
   * Find active payment info for a mentor (查找导师的有效支付信息)
   */
  async findActiveByMentorId(mentorId: string): Promise<MentorPaymentInfo | null> {
    const [record] = await this.db
      .select()
      .from(schema.mentorPaymentInfos)
      .where(
        and(
          eq(schema.mentorPaymentInfos.mentorId, mentorId),
          eq(schema.mentorPaymentInfos.status, 'ACTIVE'),
        ),
      );

    if (!record) {
      return null;
    }

    return this.mapper.toDomain(record);
  }

  /**
   * Find all payment infos for a mentor (查找导师的所有支付信息)
   */
  async findAllByMentorId(mentorId: string): Promise<MentorPaymentInfo[]> {
    const records = await this.db
      .select()
      .from(schema.mentorPaymentInfos)
      .where(eq(schema.mentorPaymentInfos.mentorId, mentorId))
      .orderBy(desc(schema.mentorPaymentInfos.createdAt));

    return records.map((record) => this.mapper.toDomain(record));
  }

  /**
   * Save a new mentor payment info (保存新导师支付信息)
   */
  async save(paymentInfo: MentorPaymentInfo): Promise<MentorPaymentInfo> {
    const record = this.mapper.toPersistence(paymentInfo);

    const [result] = await this.db.insert(schema.mentorPaymentInfos).values(record).returning();

    return this.mapper.toDomain(result);
  }

  /**
   * Update an existing mentor payment info (更新现有导师支付信息)
   */
  async update(paymentInfo: MentorPaymentInfo): Promise<MentorPaymentInfo> {
    const record = this.mapper.toPersistence(paymentInfo);

    const [result] = await this.db
      .update(schema.mentorPaymentInfos)
      .set({
        ...record,
        updatedAt: new Date(),
      })
      .where(eq(schema.mentorPaymentInfos.id, paymentInfo.getId()))
      .returning();

    if (!result) {
      throw new Error(`Mentor payment info with ID ${paymentInfo.getId()} not found`);
    }

    return this.mapper.toDomain(result);
  }

  /**
   * Execute operations within a transaction (在事务中执行操作)
   */
  async withTransaction<T>(fn: (repo: IMentorPaymentInfoRepository) => Promise<T>): Promise<T> {
    return await this.db.transaction(async (tx) => {
      // Create a new repository instance with the transaction
      const transactionalRepo = new DrizzleMentorPaymentInfoRepository(
        tx as any,
        this.mapper,
      );
      return await fn(transactionalRepo);
    });
  }
}
