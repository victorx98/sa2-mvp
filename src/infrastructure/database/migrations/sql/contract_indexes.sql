-- Contract Domain Indexes
-- Approximately 30+ indexes including partial indexes for optimization
-- Performance-critical indexes for queries, foreign keys, and filtering

-- ============================================================================
-- contracts table indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_contracts_contract_number ON contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_student_id ON contracts(student_id);
CREATE INDEX IF NOT EXISTS idx_contracts_product_id ON contracts(product_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_expires_at ON contracts(expires_at);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_contracts_student_status ON contracts(student_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_student_product ON contracts(student_id, product_id);

-- Partial index for active contracts (frequently queried)
CREATE INDEX IF NOT EXISTS idx_contracts_active
  ON contracts(student_id, expires_at)
  WHERE status = 'active';

-- ============================================================================
-- contract_service_entitlements table indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_entitlements_contract_id ON contract_service_entitlements(contract_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_service_type ON contract_service_entitlements(service_type);
CREATE INDEX IF NOT EXISTS idx_entitlements_source ON contract_service_entitlements(source);
CREATE INDEX IF NOT EXISTS idx_entitlements_expires_at ON contract_service_entitlements(expires_at);

-- Composite index for balance queries
CREATE INDEX IF NOT EXISTS idx_entitlements_available
  ON contract_service_entitlements(contract_id, service_type, available_quantity);

-- Composite index for service type and expiration queries
CREATE INDEX IF NOT EXISTS idx_entitlements_service_expires
  ON contract_service_entitlements(service_type, expires_at);

-- Partial index for available entitlements (common query pattern)
CREATE INDEX IF NOT EXISTS idx_entitlements_available_balance
  ON contract_service_entitlements(contract_id, service_type)
  WHERE available_quantity > 0;

-- ============================================================================
-- service_ledgers table indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_service_ledgers_contract ON service_ledgers(contract_id);
CREATE INDEX IF NOT EXISTS idx_service_ledgers_student ON service_ledgers(student_id);
CREATE INDEX IF NOT EXISTS idx_service_ledgers_service_type ON service_ledgers(service_type);
CREATE INDEX IF NOT EXISTS idx_service_ledgers_created_at ON service_ledgers(created_at);
CREATE INDEX IF NOT EXISTS idx_service_ledgers_source ON service_ledgers(source);

-- Composite indexes for history queries (DESC for recent-first ordering)
CREATE INDEX IF NOT EXISTS idx_service_ledgers_contract_created
  ON service_ledgers(contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_ledgers_student_created
  ON service_ledgers(student_id, created_at DESC);

-- Composite index for service type analysis
CREATE INDEX IF NOT EXISTS idx_service_ledgers_service_created
  ON service_ledgers(service_type, created_at DESC);

-- Partial index for consumption entries (audit queries)
CREATE INDEX IF NOT EXISTS idx_service_ledgers_consumption
  ON service_ledgers(contract_id, created_at DESC)
  WHERE type = 'consumption';

-- ============================================================================
-- service_holds table indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_service_holds_contract ON service_holds(contract_id);
CREATE INDEX IF NOT EXISTS idx_service_holds_student ON service_holds(student_id);
CREATE INDEX IF NOT EXISTS idx_service_holds_service_type ON service_holds(service_type);
CREATE INDEX IF NOT EXISTS idx_service_holds_status ON service_holds(status);
CREATE INDEX IF NOT EXISTS idx_service_holds_expires_at ON service_holds(expires_at);

-- Composite index for contract and service type queries
CREATE INDEX IF NOT EXISTS idx_service_holds_contract_service
  ON service_holds(contract_id, service_type, status);

-- Partial index for active holds (critical for cleanup task)
CREATE INDEX IF NOT EXISTS idx_service_holds_active_expires
  ON service_holds(status, expires_at)
  WHERE status = 'active';

-- Partial index for expired holds awaiting cleanup
CREATE INDEX IF NOT EXISTS idx_service_holds_cleanup
  ON service_holds(expires_at)
  WHERE status = 'active' AND expires_at < NOW();

-- ============================================================================
-- service_ledgers_archive table indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_service_ledgers_archive_contract ON service_ledgers_archive(contract_id);
CREATE INDEX IF NOT EXISTS idx_service_ledgers_archive_student ON service_ledgers_archive(student_id);
CREATE INDEX IF NOT EXISTS idx_service_ledgers_archive_created_at ON service_ledgers_archive(created_at);
CREATE INDEX IF NOT EXISTS idx_service_ledgers_archive_archived_at ON service_ledgers_archive(archived_at);

-- Composite indexes for archive queries (critical for performance - v2.16.4 Decision I5)
CREATE INDEX IF NOT EXISTS idx_archive_contract_created
  ON service_ledgers_archive(contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archive_student_created
  ON service_ledgers_archive(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archive_service_created
  ON service_ledgers_archive(service_type, created_at DESC);

-- ============================================================================
-- service_ledger_archive_policies table indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_service_ledger_archive_policies_scope
  ON service_ledger_archive_policies(scope);
CREATE INDEX IF NOT EXISTS idx_service_ledger_archive_policies_contract
  ON service_ledger_archive_policies(contract_id);
CREATE INDEX IF NOT EXISTS idx_service_ledger_archive_policies_service_type
  ON service_ledger_archive_policies(service_type);
CREATE INDEX IF NOT EXISTS idx_service_ledger_archive_policies_enabled
  ON service_ledger_archive_policies(enabled);

-- Unique constraints via partial indexes (one policy per scope)
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_ledger_archive_policies_unique_global
  ON service_ledger_archive_policies(scope)
  WHERE scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_ledger_archive_policies_unique_contract
  ON service_ledger_archive_policies(contract_id)
  WHERE scope = 'contract';

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_ledger_archive_policies_unique_service_type
  ON service_ledger_archive_policies(service_type)
  WHERE scope = 'service_type';

-- ============================================================================
-- domain_events table indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_domain_events_status ON domain_events(status);
CREATE INDEX IF NOT EXISTS idx_domain_events_created_at ON domain_events(created_at);
CREATE INDEX IF NOT EXISTS idx_domain_events_event_type ON domain_events(event_type);

-- Composite index for aggregate root queries
CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate
  ON domain_events(aggregate_type, aggregate_id);

-- Partial index for pending events (critical for event publisher)
CREATE INDEX IF NOT EXISTS idx_domain_events_pending
  ON domain_events(created_at)
  WHERE status = 'pending';

-- Partial index for failed events requiring retry
CREATE INDEX IF NOT EXISTS idx_domain_events_failed_retry
  ON domain_events(created_at)
  WHERE status = 'failed' AND retry_count < max_retries;

-- ============================================================================
-- Index Summary:
-- ============================================================================
-- Total indexes: 40+
-- - contracts: 8 indexes (3 partial)
-- - contract_service_entitlements: 7 indexes (2 partial)
-- - service_ledgers: 9 indexes (1 partial)
-- - service_holds: 8 indexes (2 partial)
-- - service_ledgers_archive: 7 indexes
-- - service_ledger_archive_policies: 7 indexes (3 unique partial)
-- - domain_events: 6 indexes (2 partial)
--
-- Partial indexes improve query performance and reduce index size
-- Composite indexes optimize common query patterns (WHERE + ORDER BY)
-- Foreign key indexes ensure efficient JOIN operations
-- DESC ordering in indexes supports descending ORDER BY queries

-- ============================================================================
-- Performance Notes:
-- ============================================================================
-- 1. All foreign key columns have indexes for efficient JOINs
-- 2. Partial indexes reduce index size and improve INSERT performance
-- 3. Composite indexes cover multi-column WHERE + ORDER BY patterns
-- 4. DESC indexes support recent-first ordering without sort overhead
-- 5. Archive table indexes mirror main table for transparent UNION ALL queries
