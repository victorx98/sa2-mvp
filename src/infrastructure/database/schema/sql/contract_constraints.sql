-- ==============================================================================
-- Contract Domain CHECK Constraints (v2.16.12 - 数据完整性保证)
-- ==============================================================================

-- ==============================================================================
-- Constraints for contracts table
-- ==============================================================================

-- 已付金额不能超过总金额 (Paid amount cannot exceed total amount)
ALTER TABLE contracts
DROP CONSTRAINT IF EXISTS chk_paid_amount_not_exceed_total,
ADD CONSTRAINT chk_paid_amount_not_exceed_total
CHECK (paid_amount <= total_amount);

-- 总金额必须为正数 (Total amount must be positive, except for free contracts)
ALTER TABLE contracts
DROP CONSTRAINT IF EXISTS chk_total_amount_positive,
ADD CONSTRAINT chk_total_amount_positive
CHECK (total_amount >= 0);

-- 过期时间必须晚于生效时间 (Expiration must be after effective date)
ALTER TABLE contracts
DROP CONSTRAINT IF EXISTS chk_expires_after_effective,
ADD CONSTRAINT chk_expires_after_effective
CHECK (
  expires_at IS NULL OR
  effective_at IS NULL OR
  expires_at >= effective_at
);

-- 覆盖价格必须提供原因 (Price override must provide reason)
ALTER TABLE contracts
DROP CONSTRAINT IF EXISTS chk_override_reason_required,
ADD CONSTRAINT chk_override_reason_required
CHECK (
  (override_amount IS NULL) OR
  (override_reason IS NOT NULL AND length(override_reason) > 0)
);

-- ==============================================================================
-- Constraints for contract_service_entitlements table
-- ==============================================================================

-- 可用数量必须 >= 0 (Available quantity must be >= 0)
ALTER TABLE contract_service_entitlements
DROP CONSTRAINT IF EXISTS chk_available_quantity_non_negative,
ADD CONSTRAINT chk_available_quantity_non_negative
CHECK (available_quantity >= 0);

-- 余额一致性校验 (Balance consistency check)
ALTER TABLE contract_service_entitlements
DROP CONSTRAINT IF EXISTS chk_balance_consistency,
ADD CONSTRAINT chk_balance_consistency
CHECK (
  available_quantity = total_quantity - consumed_quantity - held_quantity
);

-- 各数量字段必须 >= 0 (All quantity fields must be >= 0)
ALTER TABLE contract_service_entitlements
DROP CONSTRAINT IF EXISTS chk_quantities_non_negative,
ADD CONSTRAINT chk_quantities_non_negative
CHECK (
  total_quantity >= 0 AND
  consumed_quantity >= 0 AND
  held_quantity >= 0
);

-- 消费 + 预占不能超过总量 (Consumed + held cannot exceed total)
ALTER TABLE contract_service_entitlements
DROP CONSTRAINT IF EXISTS chk_consumed_plus_held_not_exceed_total,
ADD CONSTRAINT chk_consumed_plus_held_not_exceed_total
CHECK (
  consumed_quantity + held_quantity <= total_quantity
);

-- ==============================================================================
-- Constraints for contract_amendment_ledgers table
-- ==============================================================================

-- 变更数量必须 > 0 (Quantity changed must be > 0)
ALTER TABLE contract_amendment_ledgers
DROP CONSTRAINT IF EXISTS chk_quantity_changed_positive,
ADD CONSTRAINT chk_quantity_changed_positive
CHECK (quantity_changed > 0);

-- 原因必填 (Reason is required)
ALTER TABLE contract_amendment_ledgers
DROP CONSTRAINT IF EXISTS chk_reason_required,
ADD CONSTRAINT chk_reason_required
CHECK (
  reason IS NOT NULL AND
  length(reason) > 0
);

-- ==============================================================================
-- Constraints for service_ledgers table
-- ==============================================================================

-- 操作后余额必须 >= 0 (Balance after must be >= 0)
ALTER TABLE service_ledgers
DROP CONSTRAINT IF EXISTS chk_balance_after_non_negative,
ADD CONSTRAINT chk_balance_after_non_negative
CHECK (balance_after >= 0);

-- 数量不能为0 (Quantity cannot be 0)
ALTER TABLE service_ledgers
DROP CONSTRAINT IF EXISTS chk_quantity_not_zero,
ADD CONSTRAINT chk_quantity_not_zero
CHECK (quantity != 0);

-- 消费类型必须为负数 (Consumption type must have negative quantity)
ALTER TABLE service_ledgers
DROP CONSTRAINT IF EXISTS chk_consumption_quantity_negative,
ADD CONSTRAINT chk_consumption_quantity_negative
CHECK (
  type != 'consumption' OR quantity < 0
);

-- 退款类型必须为正数 (Refund type must have positive quantity)
ALTER TABLE service_ledgers
DROP CONSTRAINT IF EXISTS chk_refund_quantity_positive,
ADD CONSTRAINT chk_refund_quantity_positive
CHECK (
  type != 'refund' OR quantity > 0
);

-- 调整必须是提供原因 (Adjustments must provide reason)
ALTER TABLE service_ledgers
DROP CONSTRAINT IF EXISTS chk_adjustment_reason_required,
ADD CONSTRAINT chk_adjustment_reason_required
CHECK (
  type != 'adjustment' OR
  (reason IS NOT NULL AND length(reason) > 0)
);

-- ==============================================================================
-- Constraints for service_holds table
-- ==============================================================================

-- 预占数量必须为正 (Hold quantity must be positive)
ALTER TABLE service_holds
DROP CONSTRAINT IF EXISTS chk_hold_quantity_positive,
ADD CONSTRAINT chk_hold_quantity_positive
CHECK (quantity > 0);

-- 释放状态必须设置时间和原因 (Released status must have timestamp and reason)
ALTER TABLE service_holds
DROP CONSTRAINT IF EXISTS chk_released_at_required,
ADD CONSTRAINT chk_released_at_required
CHECK (
  (status != 'released' AND status != 'cancelled') OR
  (released_at IS NOT NULL AND release_reason IS NOT NULL)
);

-- ==============================================================================
-- Constraint Verification Queries (约束验证查询)
-- ==============================================================================

/*
 * 验证 contract_service_entitlements 余额一致性
 * ========================================================================
 * SELECT
 *   student_id,
 *   service_type,
 *   total_quantity,
 *   consumed_quantity,
 *   held_quantity,
 *   available_quantity,
 *   (total_quantity - consumed_quantity - held_quantity) AS calculated_available
 * FROM contract_service_entitlements
 * WHERE available_quantity != (total_quantity - consumed_quantity - held_quantity);
 * -- 预期结果: 0 行（所有记录都应该通过 CHECK 约束）
 */

/*
 * 验证 available_quantity >= 0
 * ========================================================================
 * SELECT COUNT(*) as violations
 * FROM contract_service_entitlements
 * WHERE available_quantity < 0;
 * -- 预期结果: 0
 */

/*
 * 验证 consumed + held <= total
 * ========================================================================
 * SELECT COUNT(*) as violations
 * FROM contract_service_entitlements
 * WHERE (consumed_quantity + held_quantity) > total_quantity;
 * -- 预期结果: 0
 */

/*
 * 验证 service_ledgers balance_after 非负
 * ========================================================================
 * SELECT COUNT(*) as violations
 * FROM service_ledgers
 * WHERE balance_after < 0;
 * -- 预期结果: 0
 */

/*
 * 验证 service_ledgers quantity 不为0
 * ========================================================================
 * SELECT COUNT(*) as violations
 * FROM service_ledgers
 * WHERE quantity = 0;
 * -- 预期结果: 0
 */

/*
 * 验证 service_holds quantity 为正数
 * ========================================================================
 * SELECT COUNT(*) as violations
 * FROM service_holds
 * WHERE quantity <= 0;
 * -- 预期结果: 0
 */

/*
 * 验证 service_holds released 状态有时间和原因
 * ========================================================================
 * SELECT COUNT(*) as violations
 * FROM service_holds
 * WHERE (status = 'released' OR status = 'cancelled')
 *   AND (released_at IS NULL OR release_reason IS NULL);
 * -- 预期结果: 0
 */

/*
 * 验证 contract_amendment_ledgers quantity_changed 为正数
 * ========================================================================
 * SELECT COUNT(*) as violations
 * FROM contract_amendment_ledgers
 * WHERE quantity_changed <= 0;
 * -- 预期结果: 0
 */

/*
 * 验证 contract_amendment_ledgers reason 必填
 * ========================================================================
 * SELECT COUNT(*) as violations
 * FROM contract_amendment_ledgers
 * WHERE reason IS NULL OR length(reason) = 0;
 * -- 预期结果: 0
 */

-- ==============================================================================
-- Constraint Creation Verification (约束创建验证)
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Contract Domain CHECK constraints created successfully';
  RAISE NOTICE '   - contracts: 4 constraints';
  RAISE NOTICE '   - contract_service_entitlements: 4 constraints';
  RAISE NOTICE '   - contract_amendment_ledgers: 2 constraints';
  RAISE NOTICE '   - service_ledgers: 5 constraints';
  RAISE NOTICE '   - service_holds: 2 constraints';
  RAISE NOTICE '   Total: 17 CHECK constraints';
END $$;

-- ==============================================================================
-- End of CHECK Constraints
-- ==============================================================================
