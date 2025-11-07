-- Contract Domain Triggers
-- Automatically sync consumed_quantity and held_quantity in contract_service_entitlements table
-- Design decision (v2.16.5 C-NEW-2): Trigger-based sync for data consistency

-- ============================================================================
-- Trigger 1: sync_consumed_quantity()
-- Purpose: Automatically update consumed_quantity when service_ledgers changes
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_consumed_quantity()
RETURNS TRIGGER AS $$
DECLARE
  total_consumed INT;
  entitlement_record RECORD;
BEGIN
  -- Calculate total consumed quantity for this contract and service type
  -- Sum all consumption and adjustment entries from service_ledgers
  SELECT
    contract_id,
    service_type,
    SUM(quantity) as total_change
  INTO entitlement_record
  FROM service_ledgers
  WHERE contract_id = NEW.contract_id
    AND service_type = NEW.service_type
  GROUP BY contract_id, service_type;

  -- Update contract_service_entitlements
  -- Note: quantity is already signed (negative for consumption, positive for refund/adjustment)
  -- The sum directly gives us the consumed quantity
  UPDATE contract_service_entitlements
  SET
    consumed_quantity = GREATEST(0, ABS(COALESCE(entitlement_record.total_change, 0))),
    available_quantity = total_quantity - GREATEST(0, ABS(COALESCE(entitlement_record.total_change, 0))) - held_quantity,
    updated_at = NOW()
  WHERE contract_id = NEW.contract_id
    AND service_type = NEW.service_type;

  -- Verify the update succeeded
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entitlement not found for contract_id=%, service_type=%',
      NEW.contract_id, NEW.service_type;
  END IF;

  -- Check if available_quantity is negative (should be prevented by CHECK constraint)
  IF (SELECT available_quantity FROM contract_service_entitlements
      WHERE contract_id = NEW.contract_id AND service_type = NEW.service_type) < 0 THEN
    RAISE EXCEPTION 'Insufficient balance for contract_id=%, service_type=%',
      NEW.contract_id, NEW.service_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind trigger to service_ledgers table
DROP TRIGGER IF EXISTS service_ledgers_sync_consumed_trigger ON service_ledgers;
CREATE TRIGGER service_ledgers_sync_consumed_trigger
  AFTER INSERT ON service_ledgers
  FOR EACH ROW
  EXECUTE FUNCTION sync_consumed_quantity();

-- ============================================================================
-- Trigger 2: sync_held_quantity()
-- Purpose: Automatically update held_quantity when service_holds changes
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_held_quantity()
RETURNS TRIGGER AS $$
BEGIN
  -- Scenario 1: Create new hold (INSERT with status = 'active')
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE contract_service_entitlements
    SET
      held_quantity = held_quantity + NEW.quantity,
      available_quantity = available_quantity - NEW.quantity,
      updated_at = NOW()
    WHERE contract_id = NEW.contract_id
      AND service_type = NEW.service_type;

    -- Verify the update succeeded
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Entitlement not found for contract_id=%, service_type=%',
        NEW.contract_id, NEW.service_type;
    END IF;

    -- Check if available_quantity is negative
    IF (SELECT available_quantity FROM contract_service_entitlements
        WHERE contract_id = NEW.contract_id AND service_type = NEW.service_type) < 0 THEN
      RAISE EXCEPTION 'Insufficient balance to create hold for contract_id=%, service_type=%',
        NEW.contract_id, NEW.service_type;
    END IF;

    RETURN NEW;
  END IF;

  -- Scenario 2: Release hold (UPDATE from 'active' to other status)
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'active'
     AND NEW.status != 'active' THEN
    UPDATE contract_service_entitlements
    SET
      held_quantity = held_quantity - OLD.quantity,
      available_quantity = available_quantity + OLD.quantity,
      updated_at = NOW()
    WHERE contract_id = OLD.contract_id
      AND service_type = OLD.service_type;

    -- Verify the update succeeded
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Entitlement not found for contract_id=%, service_type=%',
        OLD.contract_id, OLD.service_type;
    END IF;

    RETURN NEW;
  END IF;

  -- Other scenarios: no action needed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind trigger to service_holds table
DROP TRIGGER IF EXISTS service_holds_sync_trigger ON service_holds;
CREATE TRIGGER service_holds_sync_trigger
  AFTER INSERT OR UPDATE ON service_holds
  FOR EACH ROW
  EXECUTE FUNCTION sync_held_quantity();

-- ============================================================================
-- Trigger 3: auto_update_updated_at()
-- Purpose: Automatically update updated_at timestamp on record changes
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to contracts table
DROP TRIGGER IF EXISTS contracts_auto_update_updated_at ON contracts;
CREATE TRIGGER contracts_auto_update_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_updated_at();

-- Apply to contract_service_entitlements table
DROP TRIGGER IF EXISTS contract_service_entitlements_auto_update_updated_at ON contract_service_entitlements;
CREATE TRIGGER contract_service_entitlements_auto_update_updated_at
  BEFORE UPDATE ON contract_service_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_updated_at();

-- Apply to service_holds table
DROP TRIGGER IF EXISTS service_holds_auto_update_updated_at ON service_holds;
CREATE TRIGGER service_holds_auto_update_updated_at
  BEFORE UPDATE ON service_holds
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_updated_at();

-- Apply to service_ledger_archive_policies table
DROP TRIGGER IF EXISTS service_ledger_archive_policies_auto_update_updated_at ON service_ledger_archive_policies;
CREATE TRIGGER service_ledger_archive_policies_auto_update_updated_at
  BEFORE UPDATE ON service_ledger_archive_policies
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_updated_at();

-- ============================================================================
-- Usage Notes:
-- ============================================================================
-- 1. Application layer only needs to operate on service_ledgers and service_holds tables
-- 2. consumed_quantity and held_quantity are automatically synced by triggers
-- 3. Triggers execute within the same transaction as the INSERT/UPDATE operation
-- 4. If available_quantity becomes negative, the CHECK constraint will block the transaction
-- 5. Triggers ensure data consistency even under high concurrency

-- ============================================================================
-- Testing Triggers:
-- ============================================================================
-- -- Test sync_consumed_quantity:
-- INSERT INTO service_ledgers (contract_id, student_id, service_type, quantity, type, source, balance_after, created_by)
-- VALUES ('contract-uuid', 'student-uuid', 'resume_review', -1, 'consumption', 'booking_completed', 9, 'system');
-- -- Verify: contract_service_entitlements.consumed_quantity should increase by 1
--
-- -- Test sync_held_quantity (create hold):
-- INSERT INTO service_holds (contract_id, student_id, service_type, quantity, expires_at, created_by)
-- VALUES ('contract-uuid', 'student-uuid', 'resume_review', 1, NOW() + INTERVAL '15 minutes', 'system');
-- -- Verify: contract_service_entitlements.held_quantity should increase by 1
--
-- -- Test sync_held_quantity (release hold):
-- UPDATE service_holds SET status = 'released', release_reason = 'completed' WHERE id = 'hold-uuid';
-- -- Verify: contract_service_entitlements.held_quantity should decrease by 1
