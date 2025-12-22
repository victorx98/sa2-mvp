/**
 * MentorPaymentInfo Mapper (导师支付信息映射器)
 * Converts between domain entities and database records (在领域实体和数据库记录之间转换)
 */

import { MentorPaymentInfo, PaymentDetails, PaymentMethod } from '../../entities/mentor-payment-info.entity';
import { mentorPaymentInfos } from '@infrastructure/database/schema';

/**
 * Database record type for mentor_payment_infos table (mentor_payment_infos表的数据库记录类型)
 */
type MentorPaymentInfoRecordType = typeof mentorPaymentInfos.$inferSelect;

/**
 * Insert type for mentor_payment_infos table (mentor_payment_infos表的插入类型)
 */
type InsertMentorPaymentInfoType = typeof mentorPaymentInfos.$inferInsert;

export class MentorPaymentInfoMapper {
  /**
   * Convert database record to domain entity (将数据库记录转换为领域实体)
   *
   * @param record - Mentor payment info database record (导师支付信息数据库记录)
   * @returns MentorPaymentInfo domain entity (导师支付信息领域实体)
   */
  toDomain(record: MentorPaymentInfoRecordType): MentorPaymentInfo {
    // Parse payment details from JSONB
    const paymentDetails = record.paymentDetails as PaymentDetails;

    // Reconstruct the MentorPaymentInfo entity
    return MentorPaymentInfo.reconstruct({
      id: record.id,
      mentorId: record.mentorId,
      paymentCurrency: record.paymentCurrency,
      paymentMethod: record.paymentMethod as PaymentMethod,
      paymentDetails,
      status: record.status as 'ACTIVE' | 'INACTIVE',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy ?? undefined,
      updatedBy: record.updatedBy ?? undefined,
    });
  }

  /**
   * Convert domain entity to database record (将领域实体转换为数据库记录)
   *
   * @param paymentInfo - MentorPaymentInfo domain entity (导师支付信息领域实体)
   * @returns Database record object (数据库记录对象)
   */
  toPersistence(paymentInfo: MentorPaymentInfo): InsertMentorPaymentInfoType {
    // Convert domain entity to record
    const record: InsertMentorPaymentInfoType = {
      id: paymentInfo.getId(),
      mentorId: paymentInfo.getMentorId(),
      paymentCurrency: paymentInfo.getPaymentCurrency(),
      paymentMethod: paymentInfo.getPaymentMethod(),
      paymentDetails: paymentInfo.getPaymentDetails(),
      status: paymentInfo.getStatus(),
      createdBy: paymentInfo.getCreatedBy() ?? null,
      updatedBy: paymentInfo.getUpdatedBy() ?? null,
    };

    return record;
  }
}
