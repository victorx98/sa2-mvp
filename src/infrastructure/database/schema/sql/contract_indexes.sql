-- ==============================================================================
-- Contract Domain Indexes (v2.16.12 - 性能优化)
-- ==============================================================================

-- ==============================================================================
-- Indexes for contracts table
-- ==============================================================================

-- 按合同编号查询 (Query by contract number)
CREATE INDEX IF NOT EXISTS idx_contracts_contract_number
ON contracts(contract_number);

-- 按学生查询 (Query by student)
CREATE INDEX IF NOT EXISTS idx_contracts_student_id
ON contracts(student_id);

-- 按产品查询 (Query by product)
CREATE INDEX IF NOT EXISTS idx_contracts_product_id
ON contracts(product_id);

-- 按状态查询 (Query by status)
CREATE INDEX IF NOT EXISTS idx_contracts_status
ON contracts(status);

-- 按过期时间查询 (Query by expiration time)
CREATE INDEX IF NOT EXISTS idx_contracts_expires_at
ON contracts(expires_at);

-- 复合索引：按学生 + 状态查询 (Composite index: query by student + status)
CREATE INDEX IF NOT EXISTS idx_contracts_student_status
ON contracts(student_id, status);

-- 复合索引：按学生 + 产品查询 (Composite index: query by student + product)
CREATE INDEX IF NOT EXISTS idx_contracts_student_product
ON contracts(student_id, product_id);

-- ==============================================================================
-- Indexes for contract_service_entitlements table
-- ==============================================================================

-- 按学生查询所有权益 (Query all entitlements by student)
CREATE INDEX IF NOT EXISTS idx_entitlements_by_student
ON contract_service_entitlements(student_id, service_type);

-- 按学生 + 可用余额过滤 (Filter by student + available balance)
CREATE INDEX IF NOT EXISTS idx_entitlements_available_balance
ON contract_service_entitlements(student_id, service_type, available_quantity)
WHERE available_quantity > 0;

-- 按服务类型统计 (Statistics by service type)
CREATE INDEX IF NOT EXISTS idx_entitlements_by_service_type
ON contract_service_entitlements(service_type, student_id);

-- ==============================================================================
-- Indexes for contract_amendment_ledgers table (renamed from contract_entitlement_ledgers in v2.16.13)
-- ==============================================================================

-- 按学生查询合同修正历史 (Query amendment history by student)
CREATE INDEX IF NOT EXISTS idx_ledger_by_student
ON contract_amendment_ledgers(student_id, service_type, created_at DESC);

-- 按类型查询（统计促销活动）(Query by type - statistics for promotions)
CREATE INDEX IF NOT EXISTS idx_ledger_by_type
ON contract_amendment_ledgers(ledger_type, student_id, created_at DESC);

-- 按创建时间查询 (Query by creation time)
CREATE INDEX IF NOT EXISTS idx_ledger_created_at
ON contract_amendment_ledgers(created_at DESC);

-- 按操作人审计 (Audit by operator)
CREATE INDEX IF NOT EXISTS idx_ledger_by_created_by
ON contract_amendment_ledgers(created_by, created_at DESC);

-- 复合索引：按学生 + 服务类型 + 创建时间 (Composite: student + service type + created)
CREATE INDEX IF NOT EXISTS idx_ledger_student_service_time
ON contract_amendment_ledgers(student_id, service_type, created_at DESC);

-- ==============================================================================
-- Indexes for service_ledgers table
-- ==============================================================================

-- 按学生 + 服务类型查询 (Query by student + service type)
CREATE INDEX IF NOT EXISTS idx_ledgers_by_student_service
ON service_ledgers(student_id, service_type, created_at DESC);

-- 按服务类型统计 (Statistics by service type)
CREATE INDEX IF NOT EXISTS idx_ledgers_by_service_type
ON service_ledgers(service_type, student_id, created_at DESC);

-- 按创建时间查询 (Query by creation time)
CREATE INDEX IF NOT EXISTS idx_ledgers_created_at
ON service_ledgers(created_at DESC);

-- 复合索引：按学生 + 创建时间 (Composite: student + created)
CREATE INDEX IF NOT EXISTS idx_ledgers_student_created
ON service_ledgers(student_id, created_at DESC);

-- 按流水类型查询 (Query by ledger type)
CREATE INDEX IF NOT EXISTS idx_ledgers_by_type
ON service_ledgers(type, created_at DESC);

-- ==============================================================================
-- Indexes for service_holds table
-- ==============================================================================

-- 查询学生的活跃预占 (Query active holds for student)
CREATE INDEX IF NOT EXISTS idx_holds_by_student_active
ON service_holds(student_id, service_type, status)
WHERE status = 'active';

-- 按预约查询 (Query by booking)
CREATE INDEX IF NOT EXISTS idx_holds_by_booking
ON service_holds(related_booking_id);

-- 按创建时间查询长时间未释放的预占 (Query long-unreleased holds)
CREATE INDEX IF NOT EXISTS idx_holds_created_at
ON service_holds(created_at)
WHERE status = 'active';

-- 复合索引：按学生 + 状态 + 创建时间 (Composite: student + status + created)
CREATE INDEX IF NOT EXISTS idx_holds_student_status_created
ON service_holds(student_id, status, created_at DESC);

-- ==============================================================================
-- Partial Indexes (性能优化 - 只索引活跃记录)
-- ==============================================================================

-- 只索引可用余额大于0的权益 (Only index entitlements with available balance > 0)
CREATE INDEX IF NOT EXISTS idx_entitlements_positive_balance_partial
ON contract_service_entitlements(student_id, service_type, available_quantity)
WHERE available_quantity > 0;

-- 只索引活跃合同的合同 (Only index active contracts)
CREATE INDEX IF NOT EXISTS idx_contracts_active_partial
ON contracts(student_id, status, expires_at)
WHERE status = 'active';

-- 只索引活跃状态的预占 (Only index active holds)
CREATE INDEX IF NOT EXISTS idx_holds_active_partial
ON service_holds(student_id, service_type, created_at)
WHERE status = 'active';

-- ==============================================================================
-- Index Performance Monitoring Queries
-- ==============================================================================

/*
 * 查询索引使用情况 (Query index usage statistics)
 * ========================================================================
 * SELECT
 *   schemaname,
 *   tablename,
 *   indexname,
 *   idx_scan as index_scans,
 *   idx_tup_read as tuples_read,
 *   idx_tup_fetch as tuples_fetched
 * FROM pg_stat_user_indexes
 * WHERE schemaname = 'public'
 *   AND tablename LIKE '%contract%'
 *    OR tablename LIKE '%service%'
 * ORDER BY idx_scan DESC;
 */

/*
 * 查询未使用的索引 (Query unused indexes)
 * ========================================================================
 * SELECT
 *   schemaname || '.' || tablename as table,
 *   indexname as index_name,
 *   pg_size_pretty(pg_relation_size(schemaname || '.' || indexname)) as index_size
 * FROM pg_stat_user_indexes
 * JOIN pg_indexes USING (schemaname, tablename, indexname)
 * WHERE idx_scan = 0
 *   AND schemaname = 'public'
 * ORDER BY pg_relation_size(schemaname || '.' || indexname) DESC;
 */

/*
 * 查询索引大小 (Query index sizes)
 * ========================================================================
 * SELECT
 *   schemaname,
 *   tablename,
 *   indexname,
 *   pg_size_pretty(pg_relation_size(schemaname || '.' || indexname)) as size
 * FROM pg_indexes
 * WHERE schemaname = 'public'
 *   AND (tablename LIKE '%contract%'
 *    OR tablename LIKE '%service%'
 *    OR tablename LIKE '%entitlement%')
 * ORDER BY pg_relation_size(schemaname || '.' || indexname) DESC;
 */

-- ==============================================================================
-- Index Maintenance Commands (for reference)
-- ==============================================================================

-- 重新索引表 ( 필요할 때 실행 - Reindex table when needed)
-- REINDEX TABLE contract_service_entitlements;
-- REINDEX TABLE service_ledgers;
-- REINDEX TABLE service_holds;

-- 分析表统计信息 (Run after major data changes)
-- ANALYZE contract_service_entitlements;
-- ANALYZE service_ledgers;
-- ANALYZE service_holds;

-- ==============================================================================
-- End of Indexes
-- ==============================================================================
-- 总计约 25 个索引，覆盖所有高频查询场景 (Total ~25 indexes covering all high-frequency query scenarios)
-- ==============================================================================
