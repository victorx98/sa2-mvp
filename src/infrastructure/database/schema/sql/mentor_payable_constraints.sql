-- ==============================================================================
-- Mentor Payable Domain Constraints (数据完整性保证)
-- ==============================================================================

-- ==============================================================================
-- Constraints for mentor_payable_ledgers table
-- ==============================================================================

-- 原始记录唯一性索引 (每session/hour模式)
-- 确保每条原始记录的relation_id+source_entity组合唯一
CREATE UNIQUE INDEX IF NOT EXISTS idx_mentor_payable_relation
ON mentor_payable_ledgers(relation_id, source_entity)
WHERE original_id IS NULL;

-- 服务包计费唯一性索引
-- 确保每个服务包只在最后一个会话时计费一次
CREATE UNIQUE INDEX IF NOT EXISTS idx_mentor_payable_package
ON mentor_payable_ledgers(service_package_id, relation_id, source_entity)
WHERE original_id IS NULL AND service_package_id IS NOT NULL;

-- 导师查询优化索引
CREATE INDEX IF NOT EXISTS idx_mentor_payable_mentor
ON mentor_payable_ledgers(mentor_user_id);

-- 调整链查询索引
CREATE INDEX IF NOT EXISTS idx_mentor_payable_original
ON mentor_payable_ledgers(original_id)
WHERE original_id IS NOT NULL;

-- ==============================================================================
-- Constraints for mentor_prices table
-- ==============================================================================

-- 导师价格唯一性索引
-- 确保每个导师对每种服务类型只有一个活跃价格
CREATE UNIQUE INDEX IF NOT EXISTS idx_mentor_price_unique
ON mentor_prices(mentor_user_id, service_type_code)
WHERE status = 'active';

-- 导师价格查询优化索引
CREATE INDEX IF NOT EXISTS idx_mentor_prices_mentor
ON mentor_prices(mentor_user_id);

-- 服务包价格查询索引
CREATE INDEX IF NOT EXISTS idx_mentor_prices_package
ON mentor_prices(service_package_id)
WHERE service_package_id IS NOT NULL;