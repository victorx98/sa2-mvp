/**
 * MentorPayableLedger Mapper (导师应付账款映射器)
 * Converts between domain entities and database records (在领域实体和数据库记录之间转换)
 */

import { MentorPayableLedger } from '../../entities/mentor-payable-ledger.entity';
import { Money } from '../../value-objects/money.vo';
import { mentorPayableLedgers } from '@infrastructure/database/schema';

/**
 * Database record type for mentor_payable_ledgers table (mentor_payable_ledgers表的数据库记录类型)
 */
type MentorPayableLedgerRecordType = typeof mentorPayableLedgers.$inferSelect;

/**
 * Insert type for mentor_payable_ledgers table (mentor_payable_ledgers表的插入类型)
 */
type InsertMentorPayableLedgerType = typeof mentorPayableLedgers.$inferInsert;

export class MentorPayableLedgerMapper {
  /**
   * Convert database record to domain entity (将数据库记录转换为领域实体)
   *
   * @param record - Mentor payable ledger database record (导师应付账款数据库记录)
   * @returns MentorPayableLedger domain entity (导师应付账款领域实体)
   */
  toDomain(record: MentorPayableLedgerRecordType): MentorPayableLedger {
    // Create Money value objects
    const price = Money.reconstruct(parseFloat(record.price), record.currency);
    const amount = Money.reconstruct(parseFloat(record.amount), record.currency);

    // Reconstruct the MentorPayableLedger entity
    return MentorPayableLedger.reconstruct({
      id: record.id,
      referenceId: record.referenceId,
      mentorId: record.mentorId,
      studentId: record.studentId ?? undefined,
      sessionTypeCode: record.sessionTypeCode ?? '',
      price,
      amount,
      originalId: record.originalId ?? undefined,
      adjustmentReason: record.adjustmentReason ?? undefined,
      settlementId: record.settlementId ?? undefined,
      settledAt: record.settledAt ?? undefined,
      createdAt: record.createdAt,
      createdBy: record.createdBy ?? undefined,
    });
  }

  /**
   * Convert domain entity to database record (将领域实体转换为数据库记录)
   *
   * @param ledger - MentorPayableLedger domain entity (导师应付账款领域实体)
   * @returns Database record object (数据库记录对象)
   */
  toPersistence(ledger: MentorPayableLedger): InsertMentorPayableLedgerType {
    // Convert domain entity to record
    const record: InsertMentorPayableLedgerType = {
      id: ledger.getId(),
      referenceId: ledger.getReferenceId(),
      mentorId: ledger.getMentorId(),
      studentId: ledger.getStudentId() ?? null,
      sessionTypeCode: ledger.getSessionTypeCode(),
      price: ledger.getPrice().getAmount().toString(),
      amount: ledger.getAmount().getAmount().toString(),
      currency: ledger.getAmount().getCurrency(),
      originalId: ledger.getOriginalId() ?? null,
      adjustmentReason: ledger.getAdjustmentReason() ?? null,
      settlementId: ledger.getSettlementId() ?? null,
      settledAt: ledger.getSettledAt() ?? null,
      createdBy: ledger.getCreatedBy() ?? null,
    };

    return record;
  }
}
