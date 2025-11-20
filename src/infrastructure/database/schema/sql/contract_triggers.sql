-- ==============================================================================
-- Contract Domain Triggers (v2.16.12 - 学生级权益累积制)
-- ==============================================================================

-- ==============================================================================
-- 触发器 1: contract_amendment_ledgers → contract_service_entitlements
-- 功能: 合同修正时，自动累加 total_quantity
-- 触发时机: AFTER UPDATE
-- 版本: v2.16.12
-- ==============================================================================

CREATE OR REPLACE FUNCTION sync_ledger_to_entitlement()
RETURNS TRIGGER AS $$
BEGIN
  -- 仅处理 UPDATE 操作
  IF TG_OP = 'UPDATE' THEN
    -- 计算变更量（新旧quantity_changed之差）
    DECLARE
      quantity_diff INTEGER := NEW.quantity_changed - OLD.quantity_changed;
    BEGIN
      -- ⚠️ D-NEW-1 决策: 只执行 UPDATE，不执行 INSERT
      -- 如果记录不存在，抛异常（确保初始权益已存在）
      UPDATE contract_service_entitlements AS cse
      SET
        total_quantity = cse.total_quantity + quantity_diff,
        available_quantity = cse.total_quantity + quantity_diff
                           - cse.consumed_quantity
                           - cse.held_quantity,
        updated_at = NOW()
      WHERE cse.student_id = NEW.student_id
        AND cse.service_type = NEW.service_type;

      -- 验证更新成功（记录必须存在）
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Entitlement not found for student_id=%, service_type=%. '
                        'Initial entitlement must be created before adding ledger entries.',
          NEW.student_id, NEW.service_type;
      END IF;
    END;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 绑定触发器到 contract_amendment_ledgers 表
DROP TRIGGER IF EXISTS trigger_ledger_insert ON contract_amendment_ledgers;

CREATE TRIGGER trigger_ledger_update
  AFTER UPDATE
  ON contract_amendment_ledgers
  FOR EACH ROW
  EXECUTE FUNCTION sync_ledger_to_entitlement();

-- ==============================================================================
-- 触发器 2: service_ledgers → contract_service_entitlements
-- 功能: 服务消费流水新增时，自动累加 consumed_quantity
-- 触发时机: AFTER INSERT
-- 版本: v2.16.12
-- ==============================================================================

CREATE OR REPLACE FUNCTION sync_consumption_to_entitlement()
RETURNS TRIGGER AS $$
BEGIN
  -- 仅处理 INSERT 操作
  IF TG_OP = 'INSERT' THEN
    UPDATE contract_service_entitlements
    SET
      -- quantity 为负数（消费），取反后累加 (quantity is negative (consumption), invert and accumulate)
      consumed_quantity = consumed_quantity + (-NEW.quantity),

      -- 重新计算可用余额 (Recalculate available balance)
      -- available = total - (consumed + (-quantity)) - held
      available_quantity = total_quantity
                         - (consumed_quantity + (-NEW.quantity))
                         - held_quantity,

      updated_at = NOW()
    WHERE student_id = NEW.student_id
      AND service_type = NEW.service_type;

    -- 验证更新成功
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Entitlement not found for student_id=%, service_type=%',
        NEW.student_id, NEW.service_type;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 绑定触发器到 service_ledgers 表
DROP TRIGGER IF EXISTS trigger_service_ledger_insert ON service_ledgers;

CREATE TRIGGER trigger_service_ledger_insert
  AFTER INSERT
  ON service_ledgers
  FOR EACH ROW
  EXECUTE FUNCTION sync_consumption_to_entitlement();

-- ==============================================================================
-- 触发器 3: service_holds → contract_service_entitlements
-- 功能: 服务预占状态变更时，自动更新 held_quantity
-- 触发时机: AFTER INSERT OR UPDATE
-- 版本: v2.16.12
-- ==============================================================================

CREATE OR REPLACE FUNCTION sync_hold_to_entitlement()
RETURNS TRIGGER AS $$
BEGIN
  -- 场景 1: 创建新预占 (INSERT 且 status = 'active')
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE contract_service_entitlements
    SET
      held_quantity = held_quantity + NEW.quantity,

      -- 可用余额减少 (Available balance decreases)
      available_quantity = total_quantity
                         - consumed_quantity
                         - (held_quantity + NEW.quantity),

      updated_at = NOW()
    WHERE student_id = NEW.student_id
      AND service_type = NEW.service_type;

    -- 验证更新成功
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Entitlement not found for student_id=%, service_type=%',
        NEW.student_id, NEW.service_type;
    END IF;

    RETURN NEW;
  END IF;

  -- 场景 2: 释放预占 (UPDATE 且 status 从 'active' 变为其他)
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'active'
     AND NEW.status != 'active' THEN

    UPDATE contract_service_entitlements
    SET
      held_quantity = held_quantity - OLD.quantity,

      -- 可用余额增加 (Available balance increases)
      available_quantity = total_quantity
                         - consumed_quantity
                         - (held_quantity - OLD.quantity),

      updated_at = NOW()
    WHERE student_id = OLD.student_id
      AND service_type = OLD.service_type;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 绑定触发器到 service_holds 表
DROP TRIGGER IF EXISTS trigger_hold_change ON service_holds;

CREATE TRIGGER trigger_hold_change
  AFTER INSERT OR UPDATE
  ON service_holds
  FOR EACH ROW
  EXECUTE FUNCTION sync_hold_to_entitlement();

-- ==============================================================================
-- 触发器 4: contracts → contract_service_entitlements
-- 功能: 合同终止时，冻结所有权益（available_quantity = 0）
-- 触发时机: AFTER UPDATE OF status ON contracts
-- 版本: v2.16.12
-- 决策: D-NEW-3 方案B - 合同终止后冻结权益
-- ==============================================================================

CREATE OR REPLACE FUNCTION freeze_entitlements_on_contract_termination()
RETURNS TRIGGER AS $$
BEGIN
  -- 当合同状态变为 'terminated' 时
  IF NEW.status::text = 'terminated' AND OLD.status::text != 'terminated' THEN
    -- 冻结该学生的所有权益（available_quantity = 0）
    UPDATE contract_service_entitlements
    SET
      available_quantity = 0,
      updated_at = NOW()
    WHERE student_id = NEW.student_id;

    -- v2.16.12 变更: 审计信息记录在 contracts 表（已包含 status, terminated_at, student_id）
    -- 不再单独记录到 entitlement_freeze_logs

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 绑定触发器到 contracts 表
DROP TRIGGER IF EXISTS trigger_contract_terminated ON contracts;

CREATE TRIGGER trigger_contract_terminated
  AFTER UPDATE OF status
  ON contracts
  FOR EACH ROW
  WHEN (NEW.status = 'terminated' AND OLD.status != 'terminated')
  EXECUTE FUNCTION freeze_entitlements_on_contract_termination();

-- ==============================================================================
-- 审计日志表: entitlement_freeze_logs
-- 用途: 记录权益冻结操作，用于审计追溯
-- ==============================================================================

-- ==============================================================================
-- Trigger 测试和验证 (Testing and Verification)
-- ==============================================================================

/*
 * 测试 Trigger 1: contract_amendment_ledgers INSERT
 * ========================================================================
 * -- 准备测试数据
 * INSERT INTO users (id, email) VALUES ('stu-001', 'test@example.com');
 *
 * -- 创建初始权益（应用层直接 INSERT）
 * INSERT INTO contract_service_entitlements
 *   (student_id, service_type, total_quantity, consumed_quantity, held_quantity, available_quantity)
 * VALUES ('stu-001', 'session', 5, 0, 0, 5);
 *
 * -- 测试触发器：添加合同修正
 * INSERT INTO contract_amendment_ledgers
 *   (student_id, service_type, ledger_type, quantity_changed, reason, created_by)
 * VALUES ('stu-001', 'session', 'promotion', 2, '双十一促销', 'admin-001');
 *
 * -- 验证结果
 * SELECT * FROM contract_service_entitlements
 * WHERE student_id = 'stu-001' AND service_type = 'session';
 * -- 预期: total_quantity = 7, available_quantity = 7
 *
 * -- 测试异常场景：权益记录不存在
 * INSERT INTO contract_amendment_ledgers
 *   (student_id, service_type, ledger_type, quantity_changed, reason, created_by)
 * VALUES ('stu-001', 'mock_interview', 'addon', 1, '测试', 'admin-001');
 * -- 预期: 抛出异常 'Entitlement not found...'
 */

/*
 * 测试 Trigger 2: service_ledgers INSERT
 * ========================================================================
 * -- 消费服务
 * INSERT INTO service_ledgers
 *   (student_id, service_type, quantity, type, source, balance_after, created_by)
 * VALUES ('stu-001', 'session', -1, 'consumption', 'booking_completed', 6, 'mentor-001');
 *
 * -- 验证结果
 * SELECT * FROM contract_service_entitlements
 * WHERE student_id = 'stu-001' AND service_type = 'session';
 * -- 预期: consumed_quantity = 1, available_quantity = 6
 */

/*
 * 测试 Trigger 3: service_holds INSERT/UPDATE
 * ========================================================================
 * -- 创建预占
 * INSERT INTO service_holds
 *   (student_id, service_type, quantity, status, created_by)
 * VALUES ('stu-001', 'session', 1, 'active', 'student-001');
 *
 * -- 验证结果
 * SELECT * FROM contract_service_entitlements
 * WHERE student_id = 'stu-001' AND service_type = 'session';
 * -- 预期: held_quantity = 1, available_quantity = 5
 *
 * -- 释放预占
 * UPDATE service_holds
 * SET status = 'released', released_at = NOW(), release_reason = 'completed'
 * WHERE student_id = 'stu-001' AND service_type = 'session' AND status = 'active';
 *
 * -- 验证结果
 * SELECT * FROM contract_service_entitlements
 * WHERE student_id = 'stu-001' AND service_type = 'session';
 * -- 预期: held_quantity = 0, available_quantity = 6
 */

/*
 * 测试 Trigger 4: contracts UPDATE (terminate) - v2.16.12 审计信息记录在 contracts 表
 * ========================================================================
 * -- 更新合同状态为 terminated
 * UPDATE contracts
 * SET status = 'terminated'
 * WHERE student_id = 'stu-001';
 *
 * -- 验证结果: 权益被冻结
 * SELECT * FROM contract_service_entitlements
 * WHERE student_id = 'stu-001';
 * -- 预期: available_quantity = 0（所有权益被冻结）
 *
 * -- 验证结果: 审计信息在 contracts 表
 * SELECT status, terminated_at, student_id, contract_number
 * FROM contracts
 * WHERE student_id = 'stu-001'
 *   AND status = 'terminated';
 * -- 预期: 审计信息记录在 contracts 表（status, terminated_at, student_id）
 */

-- ==============================================================================
-- End of Contract Triggers
-- ==============================================================================
