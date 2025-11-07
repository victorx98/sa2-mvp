-- Contract Domain CHECK Constraints
-- Approximately 20+ constraints for data integrity and business rule enforcement
-- Naming convention: chk_<table>_<field>_<type>

-- ============================================================================
-- contracts table constraints
-- ============================================================================

-- Price validation constraints
ALTER TABLE contracts
  ADD CONSTRAINT IF NOT EXISTS chk_contracts_total_amount_positive
  CHECK (total_amount > 0);

ALTER TABLE contracts
  ADD CONSTRAINT IF NOT EXISTS chk_contracts_override_amount_positive
  CHECK (override_amount IS NULL OR override_amount >= 0);

-- Price override must have reason and approver
ALTER TABLE contracts
  ADD CONSTRAINT IF NOT EXISTS chk_contracts_override_requires_reason
  CHECK (
    (override_amount IS NULL) OR
    (override_reason IS NOT NULL AND length(override_reason) > 0)
  );

ALTER TABLE contracts
  ADD CONSTRAINT IF NOT EXISTS chk_contracts_override_requires_approver
  CHECK (
    (override_amount IS NULL) OR
    (override_approved_by IS NOT NULL)
  );

-- Validity period constraints
ALTER TABLE contracts
  ADD CONSTRAINT IF NOT EXISTS chk_contracts_validity_days_positive
  CHECK (validity_days IS NULL OR validity_days > 0);

-- Expiration date must be after signing date (when specified)
ALTER TABLE contracts
  ADD CONSTRAINT IF NOT EXISTS chk_contracts_expires_after_signed
  CHECK (expires_at IS NULL OR expires_at > signed_at);

-- Lifecycle timestamp constraints
ALTER TABLE contracts
  ADD CONSTRAINT IF NOT EXISTS chk_contracts_activated_after_signed
  CHECK (activated_at IS NULL OR activated_at >= signed_at);

ALTER TABLE contracts
  ADD CONSTRAINT IF NOT EXISTS chk_contracts_suspended_after_activated
  CHECK (suspended_at IS NULL OR suspended_at >= activated_at);

ALTER TABLE contracts
  ADD CONSTRAINT IF NOT EXISTS chk_contracts_completed_after_activated
  CHECK (completed_at IS NULL OR completed_at >= activated_at);

ALTER TABLE contracts
  ADD CONSTRAINT IF NOT EXISTS chk_contracts_terminated_after_activated
  CHECK (terminated_at IS NULL OR terminated_at >= activated_at);

-- Suspension count must be non-negative
ALTER TABLE contracts
  ADD CONSTRAINT IF NOT EXISTS chk_contracts_suspension_count_non_negative
  CHECK (suspension_count >= 0);

-- ============================================================================
-- contract_service_entitlements table constraints
-- ============================================================================

-- Quantity constraints
ALTER TABLE contract_service_entitlements
  ADD CONSTRAINT IF NOT EXISTS chk_entitlements_total_quantity_non_negative
  CHECK (total_quantity >= 0);

ALTER TABLE contract_service_entitlements
  ADD CONSTRAINT IF NOT EXISTS chk_entitlements_consumed_quantity_non_negative
  CHECK (consumed_quantity >= 0);

ALTER TABLE contract_service_entitlements
  ADD CONSTRAINT IF NOT EXISTS chk_entitlements_held_quantity_non_negative
  CHECK (held_quantity >= 0);

ALTER TABLE contract_service_entitlements
  ADD CONSTRAINT IF NOT EXISTS chk_entitlements_available_quantity_non_negative
  CHECK (available_quantity >= 0);

-- Balance consistency: available = total - consumed - held
ALTER TABLE contract_service_entitlements
  ADD CONSTRAINT IF NOT EXISTS chk_entitlements_quantity_consistency
  CHECK (available_quantity = total_quantity - consumed_quantity - held_quantity);

-- Consumed + held cannot exceed total
ALTER TABLE contract_service_entitlements
  ADD CONSTRAINT IF NOT EXISTS chk_entitlements_consumed_held_within_total
  CHECK (consumed_quantity + held_quantity <= total_quantity);

-- Source-specific validation (v2.16.4)
-- When source='addon' or 'compensation', add_on_reason must be provided
-- Note: add_on_reason field may not exist in current schema, this is for future use
-- ALTER TABLE contract_service_entitlements
--   ADD CONSTRAINT IF NOT EXISTS chk_entitlements_addon_requires_reason
--   CHECK (
--     (source NOT IN ('addon', 'compensation')) OR
--     (add_on_reason IS NOT NULL AND length(add_on_reason) > 0)
--   );

-- When source='product', origin_items must be provided
ALTER TABLE contract_service_entitlements
  ADD CONSTRAINT IF NOT EXISTS chk_entitlements_product_requires_origin_items
  CHECK (
    (source != 'product') OR
    (origin_items IS NOT NULL)
  );

-- When source='product', service_snapshot must be provided
ALTER TABLE contract_service_entitlements
  ADD CONSTRAINT IF NOT EXISTS chk_entitlements_product_requires_service_snapshot
  CHECK (
    (source != 'product') OR
    (service_snapshot IS NOT NULL)
  );

-- Unique constraint: (contract_id, service_type, expires_at, source) - v2.16.7
ALTER TABLE contract_service_entitlements
  ADD CONSTRAINT IF NOT EXISTS uq_entitlements_key
  UNIQUE (contract_id, service_type, expires_at, source);

-- ============================================================================
-- service_ledgers table constraints
-- ============================================================================

-- Balance after must be non-negative
ALTER TABLE service_ledgers
  ADD CONSTRAINT IF NOT EXISTS chk_ledgers_balance_after_non_negative
  CHECK (balance_after >= 0);

-- Quantity cannot be zero
ALTER TABLE service_ledgers
  ADD CONSTRAINT IF NOT EXISTS chk_ledgers_quantity_not_zero
  CHECK (quantity != 0);

-- Type-specific quantity constraints
ALTER TABLE service_ledgers
  ADD CONSTRAINT IF NOT EXISTS chk_ledgers_consumption_quantity_negative
  CHECK (type != 'consumption' OR quantity < 0);

ALTER TABLE service_ledgers
  ADD CONSTRAINT IF NOT EXISTS chk_ledgers_refund_quantity_positive
  CHECK (type != 'refund' OR quantity > 0);

ALTER TABLE service_ledgers
  ADD CONSTRAINT IF NOT EXISTS chk_ledgers_initial_quantity_positive
  CHECK (type != 'initial' OR quantity > 0);

ALTER TABLE service_ledgers
  ADD CONSTRAINT IF NOT EXISTS chk_ledgers_expiration_quantity_negative
  CHECK (type != 'expiration' OR quantity < 0);

-- When type='adjustment', reason must be provided
ALTER TABLE service_ledgers
  ADD CONSTRAINT IF NOT EXISTS chk_ledgers_adjustment_requires_reason
  CHECK (
    (type != 'adjustment') OR
    (reason IS NOT NULL AND length(reason) > 0)
  );

-- ============================================================================
-- service_holds table constraints
-- ============================================================================

-- Quantity must be positive
ALTER TABLE service_holds
  ADD CONSTRAINT IF NOT EXISTS chk_holds_quantity_positive
  CHECK (quantity > 0);

-- Expires at must be after created at
ALTER TABLE service_holds
  ADD CONSTRAINT IF NOT EXISTS chk_holds_expires_after_created
  CHECK (expires_at > created_at);

-- When status='released', released_at must be set
ALTER TABLE service_holds
  ADD CONSTRAINT IF NOT EXISTS chk_holds_released_has_timestamp
  CHECK (
    (status != 'released') OR
    (released_at IS NOT NULL)
  );

-- When status='released', release_reason must be set
ALTER TABLE service_holds
  ADD CONSTRAINT IF NOT EXISTS chk_holds_released_has_reason
  CHECK (
    (status != 'released') OR
    (release_reason IS NOT NULL AND length(release_reason) > 0)
  );

-- ============================================================================
-- service_ledger_archive_policies table constraints
-- ============================================================================

-- Archive after days must be positive
ALTER TABLE service_ledger_archive_policies
  ADD CONSTRAINT IF NOT EXISTS chk_archive_policies_days_positive
  CHECK (archive_after_days > 0);

-- When scope='contract', contract_id must be provided
ALTER TABLE service_ledger_archive_policies
  ADD CONSTRAINT IF NOT EXISTS chk_archive_policies_contract_scope_has_contract_id
  CHECK (
    (scope != 'contract') OR
    (contract_id IS NOT NULL)
  );

-- When scope='service_type', service_type must be provided
ALTER TABLE service_ledger_archive_policies
  ADD CONSTRAINT IF NOT EXISTS chk_archive_policies_service_type_scope_has_service_type
  CHECK (
    (scope != 'service_type') OR
    (service_type IS NOT NULL)
  );

-- When scope='global', both contract_id and service_type must be NULL
ALTER TABLE service_ledger_archive_policies
  ADD CONSTRAINT IF NOT EXISTS chk_archive_policies_global_scope_no_entity
  CHECK (
    (scope != 'global') OR
    (contract_id IS NULL AND service_type IS NULL)
  );

-- ============================================================================
-- domain_events table constraints
-- ============================================================================

-- Event type must not be empty
ALTER TABLE domain_events
  ADD CONSTRAINT IF NOT EXISTS chk_domain_events_event_type_not_empty
  CHECK (length(event_type) > 0);

-- Aggregate type must not be empty
ALTER TABLE domain_events
  ADD CONSTRAINT IF NOT EXISTS chk_domain_events_aggregate_type_not_empty
  CHECK (length(aggregate_type) > 0);

-- Retry count must be non-negative
ALTER TABLE domain_events
  ADD CONSTRAINT IF NOT EXISTS chk_domain_events_retry_count_non_negative
  CHECK (retry_count >= 0);

-- Max retries must be positive
ALTER TABLE domain_events
  ADD CONSTRAINT IF NOT EXISTS chk_domain_events_max_retries_positive
  CHECK (max_retries > 0);

-- Retry count cannot exceed max retries
ALTER TABLE domain_events
  ADD CONSTRAINT IF NOT EXISTS chk_domain_events_retry_count_within_max
  CHECK (retry_count <= max_retries);

-- When status='published', published_at must be set
ALTER TABLE domain_events
  ADD CONSTRAINT IF NOT EXISTS chk_domain_events_published_has_timestamp
  CHECK (
    (status != 'published') OR
    (published_at IS NOT NULL)
  );

-- When status='failed', error_message should be set (warning, not enforced)
-- ALTER TABLE domain_events
--   ADD CONSTRAINT IF NOT EXISTS chk_domain_events_failed_has_error_message
--   CHECK (
--     (status != 'failed') OR
--     (error_message IS NOT NULL AND length(error_message) > 0)
--   );

-- ============================================================================
-- Constraint Summary:
-- ============================================================================
-- Total constraints: 40+
-- - contracts: 11 constraints
-- - contract_service_entitlements: 10 constraints
-- - service_ledgers: 8 constraints
-- - service_holds: 4 constraints
-- - service_ledger_archive_policies: 4 constraints
-- - domain_events: 6 constraints
--
-- Constraint types:
-- - Positive/non-negative value validation
-- - Timestamp ordering validation
-- - Conditional field requirements (IF-THEN logic)
-- - Type-specific business rules
-- - Balance consistency checks
-- - Enum-specific validations

-- ============================================================================
-- Important Notes:
-- ============================================================================
-- 1. Constraints are enforced at database level for data integrity
-- 2. Application layer should validate before INSERT/UPDATE to provide better error messages
-- 3. Some constraints use conditional logic (CHECK with OR/AND)
-- 4. Constraints complement triggers for complete data consistency
-- 5. Failed constraint checks will ROLLBACK the entire transaction
