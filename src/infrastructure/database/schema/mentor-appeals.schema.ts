import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  text,
} from "drizzle-orm/pg-core";

/**
 * Mentor Appeals Table (导师申诉表)
 *
 * Design Principles (设计原则):
 * 1. **Immutable Table**: No UPDATE/DELETE, only INSERT
 *    - No updatedAt/updatedBy fields
 *    - Each record is permanent and append-only
 *    - Status changes create new records (or use events for audit trail)
 *    (不可变表：无UPDATE/DELETE，仅INSERT - 无updatedAt/updatedBy字段)
 *
 * 2. **Anti-Corruption Layer**: No foreign keys to other domains
 *    - Use string UUID references instead of foreign keys
 *    - Comment foreign keys for documentation
 *    (防腐层：不关联其他域的表 - 使用字符串UUID引用，注释说明外键)
 *
 * 3. **Status Lifecycle**: PENDING → APPROVED or REJECTED
 *    - Only transitions from PENDING are allowed
 *    - Status changes should be recorded via events
 *    (状态生命周期：PENDING只能转换为APPROVED或REJECTED)
 *
 * 4. **Audit Trail**: Maintained via createdBy and status transition events
 *    - createdBy tracks who submitted the appeal
 *    - approvedBy/rejectedBy track who processed the appeal
 *    (审计追踪：通过创建者和状态转换事件记录)
 *
 * 5. **Relationship Snapshots**: Store UUID references to related records
 *    - mentor_payable_id links to the disputed transaction
 *    - settlement_id links to the settlement batch (if applicable)
 *    (关联快照：存储UUID引用到相关记录)
 */
export const mentorAppeals = pgTable("mentor_appeals", {
  // ========== Primary Key ==========
  /**
   * Primary Key (主键)
   */
  id: uuid("id").primaryKey().defaultRandom(),

  // ========== Participants ==========
  /**
   * Mentor ID (导师ID)
   * References: mentor.id
   * (引用导师表的ID)
   */
  mentorId: uuid("mentor_id").notNull(),

  /**
   * Counselor ID (处理顾问ID)
   * References: counselor.id
   * (引用顾问表的ID)
   */
  counselorId: uuid("counselor_id").notNull(),

  // ========== Related Financial Records ==========
  /**
   * Mentor Payable Ledger ID (关联应付账款ID)
   * References: mentor_payable_ledgers.id
   * Nullable: Appeals may not be tied to a specific transaction
   * (关联应付账款记录的ID - 可为空)
   */
  mentorPayableId: uuid("mentor_payable_id"),

  /**
   * Settlement Ledger ID (关联结算ID)
   * References: settlement_ledgers.id
   * Nullable: Appeals may not be tied to a specific settlement batch
   * (关联结算记录的ID - 可为空)
   */
  settlementId: uuid("settlement_id"),

  // ========== Appeal Details ==========
  /**
   * Appeal Type (申诉类型)
   * Values: billing_error, missing_service, price_dispute, other
   * (申诉类型：费用计算错误、遗漏服务记录、价格争议、其他)
   */
  appealType: varchar("appeal_type", { length: 50 }).notNull(),

  /**
   * Appeal Amount (申诉金额)
   * The amount the mentor is disputing or requesting
   * Precision: 12 digits total, 2 decimal places
   * (申诉金额 - 导师争议或申请的金额)
   */
  appealAmount: numeric("appeal_amount", { precision: 12, scale: 2 }).notNull(),

  /**
   * Currency (货币类型)
   * ISO 4217 currency code
   * Default: USD
   * (货币 - ISO 4217货币代码)
   */
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),

  /**
   * Appeal Reason (申诉理由)
   * Detailed description of why the mentor is appealing
   * (申诉的详细理由和描述)
   */
  reason: text("reason").notNull(),

  /**
   * Status (申诉状态)
   * Values: PENDING, APPROVED, REJECTED
   * Initial value: PENDING
   * (申诉状态：待处理、已批准、已驳回)
   */
  status: varchar("status", { length: 20 }).notNull().default("PENDING"),

  /**
   * Rejection Reason (驳回理由)
   * Required only when status = REJECTED
   * (驳回申诉的理由 - 仅在状态为REJECTED时有效)
   */
  rejectionReason: text("rejection_reason"),

  /**
   * Comments (申诉评论)
   * Additional comments added during appeal processing
   * (申诉处理过程中添加的额外评论)
   */
  comments: text("comments"),

  // ========== Processing Records ==========
  /**
   * Approved By (审批人ID)
   * References: counselor.id or other user tables
   * Set when status changes to APPROVED
   * (审批该申诉的用户ID)
   */
  approvedBy: uuid("approved_by"),

  /**
   * Approved At (审批时间)
   * Timestamp when status changed to APPROVED
   * (申诉被批准的时间戳)
   */
  approvedAt: timestamp("approved_at", { withTimezone: true }),

  /**
   * Rejected By (驳回人ID)
   * References: counselor.id or other user tables
   * Set when status changes to REJECTED
   * (驳回该申诉的用户ID)
   */
  rejectedBy: uuid("rejected_by"),

  /**
   * Rejected At (驳回时间)
   * Timestamp when status changed to REJECTED
   * (申诉被驳回的时间戳)
   */
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),

  // ========== Audit Trail ==========
  /**
   * Created By (创建人ID)
   * References: identity.users.id
   * The mentor who submitted the appeal
   * (提交申诉的导师ID)
   */
  createdBy: uuid("created_by").notNull(),

  /**
   * Created At (创建时间)
   * Timestamp when the appeal was submitted
   * Default: NOW()
   * (申诉提交的时间戳)
   */
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type MentorAppeal = typeof mentorAppeals.$inferSelect;
export type InsertMentorAppeal = typeof mentorAppeals.$inferInsert;

/**
 * Recommended Indexes (推荐的索引):
 *
 * 1. idx_mentor_appeals_mentor_id
 *    Purpose: Query appeals by mentor
 *    (查询导师的申诉记录)
 *
 * 2. idx_mentor_appeals_counselor_id
 *    Purpose: Query appeals assigned to counselor
 *    (查询分配给顾问的申诉)
 *
 * 3. idx_mentor_appeals_status
 *    Purpose: Query appeals by status
 *    (按状态筛选申诉)
 *
 * 4. idx_mentor_appeals_mentor_payable_id
 *    Purpose: Query appeals related to specific payable ledger
 *    (查询关联到特定应付账款的申诉)
 *
 * 5. idx_mentor_appeals_settlement_id
 *    Purpose: Query appeals related to specific settlement batch
 *    (查询关联到特定结算批次的申诉)
 *
 * 6. idx_mentor_appeals_created_at
 *    Purpose: Sort/Filter appeals by creation time
 *    (按创建时间排序/筛选)
 *
 * 7. idx_mentor_appeals_approved_at
 *    Purpose: Analytics on processing time
 *    (分析申诉处理时长)
 *
 * 8. idx_mentor_appeals_rejected_at
 *    Purpose: Analytics on rejection patterns
 *    (分析申诉驳回模式)
 */
